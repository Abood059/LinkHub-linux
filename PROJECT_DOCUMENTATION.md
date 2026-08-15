# LinkHub Desktop Application - Comprehensive Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Project Function and Objectives](#project-function-and-objectives)
3. [Architecture and Design Style](#architecture-and-design-style)
4. [Layered Architecture](#layered-architecture)
5. [Project Scope and Use Cases](#project-scope-and-use-cases)
6. [Technology Stack](#technology-stack)

---

## Project Overview

### Project Definition
**LinkHub** is a cross-platform desktop application that bridges Android devices and internet-based media content. It provides a unified interface for managing connected Android devices, downloading media from the internet, and seamlessly transferring downloaded content to selected devices. The application operates on desktop systems (Linux, macOS, Windows) and communicates with Android devices via USB or TCP/IP protocols.

### Core Identity
- **Type**: Desktop Application Framework
- **Platform Target**: Linux, macOS, Windows
- **Primary Function**: Device-to-Internet Media Distribution Platform
- **Architecture Pattern**: Layered (Domain-Driven Design + Clean Architecture)
- **Primary Language**: JavaScript (Node.js/Electron)

---

## Project Function and Objectives

### Main Objectives

1. **Device Management**
   - Establish and maintain connections with Android devices
   - Discover connected devices in real-time
   - Store device metadata and user preferences
   - Manage device trust and favorite status

2. **Media Download & Processing**
   - Download videos, audio, and media content from various internet sources
   - Extract metadata and format information from media URLs
   - Provide format selection and quality options
   - Handle download retry logic and error recovery

3. **Content Distribution**
   - Transfer downloaded media to one or multiple selected Android devices
   - Monitor transfer progress and provide real-time feedback
   - Handle file system operations on target devices
   - Manage storage space constraints on target devices

4. **User Interface**
   - Desktop GUI (Electron) for interactive media management
   - Terminal-based CLI (TUI) for command-line operations
   - Real-time status updates and progress tracking
   - Device and download state synchronization

5. **Process Management**
   - Supervise external processes (ADB, yt-dlp, scrcpy)
   - Handle graceful shutdown and cleanup
   - Implement robust error handling and logging
   - Maintain process lifecycle through application runtime

### Key Capabilities

- **Multi-Device Support**: Simultaneously manage multiple connected Android devices
- **Batch Operations**: Download to and distribute to multiple devices at once
- **Real-time Synchronization**: Keep UI in sync with backend state (every 300ms)
- **Persistent Storage**: SQLite database for device history, preferences, and metadata
- **Error Recovery**: Automatic retry mechanisms and detailed error logging
- **Headless Operation**: CLI mode for server or automation scenarios
- **Plugin Architecture**: Adapters for external tools (yt-dlp, ADB, scrcpy)

---

## Architecture and Design Style

### Architectural Style: Clean Architecture with Domain-Driven Design

LinkHub follows **Clean Architecture** principles with **Domain-Driven Design (DDD)** concepts:

#### Key Principles Applied:
1. **Dependency Inversion**: High-level modules depend on abstractions, not low-level implementations
2. **Separation of Concerns**: Each layer has well-defined responsibilities
3. **Testability**: Business logic separated from infrastructure concerns
4. **Independence**: Core business logic independent of UI framework choices
5. **Maintainability**: Clear boundaries and interfaces between components

### Design Patterns Used

1. **Orchestrator Pattern**
   - `DeviceOrchestrator`: Coordinates device lifecycle operations
   - `DownloadOrchestrator`: Coordinates download workflow
   - `TransferOrchestrator`: Coordinates file transfer operations
   - Orchestrators contain business logic but delegate technical execution

2. **Adapter Pattern**
   - `ScrcpyAdapter`: Abstracts screen mirroring tool interaction
   - `YtdlpAdapter`: Abstracts media download tool integration
   - `AdbPushService`: Abstracts file transfer operations

3. **Service Locator / Dependency Injection**
   - Central container (`BootstrapContainer`) manages service lifecycle
   - All dependencies injected at bootstrap time
   - Services resolved through the container

4. **State Synchronization Pattern**
   - `DeviceStateSyncService`: Periodic device state synchronization (1s interval)
   - `DownloadStateSyncService`: Rapid download progress updates (300ms interval)
   - `TransferStateSyncService`: File transfer state updates (300ms interval)
   - Single source of truth principle for each domain

5. **Entity/Value Object Pattern**
   - Immutable entities (`Device`, `BaseFile`, `AudioFile`, `VideoFile`)
   - Value objects for cross-cutting concerns (`FileStatus`)
   - Domain objects encapsulate business logic

6. **Repository Pattern**
   - `DeviceRepository`: Abstracts device persistence
   - `DownloadRepository`: Abstracts download history storage
   - In-memory management with periodic sync to database

7. **Event Handler Pattern**
   - `DeviceEventHandler`: Manages device state change events
   - `DownloadEventHandler`: Manages download lifecycle events
   - Decouples event sources from consumers

### Principles Observed

- **Single Responsibility**: Each class has one reason to change
- **Open/Closed**: Open for extension through adapters, closed for modification
- **Liskov Substitution**: Adapters are interchangeable implementations
- **Interface Segregation**: Minimal, focused interfaces
- **Dependency Inversion**: Depend on abstractions, not concrete implementations

---

## Layered Architecture

### Layer Structure

LinkHub implements a **5-layer architecture**:

```
┌─────────────────────────────────────────────────┐
│                   PRESENTATION LAYER            │
│     (Electron GUI + CLI + Web Interface)        │
├─────────────────────────────────────────────────┤
│              APPLICATION LAYER                  │
│   (Orchestrators + Handlers + Event Bridges)    │
├─────────────────────────────────────────────────┤
│                 DOMAIN LAYER                    │
│      (Entities + Value Objects + Business Rules)│
├─────────────────────────────────────────────────┤
│            INFRASTRUCTURE LAYER                 │
│  (Services + Adapters + External Tools Wrappers)│
├─────────────────────────────────────────────────┤
│              RUNTIME LAYER                      │
│    (State Management + Process Supervision)     │
└─────────────────────────────────────────────────┘
```

### Layer 1: Presentation Layer (User Interface)

**Location**: `/src/renderer`, `/src/cli`, `/src/preload`

**Responsibility**: Accept user input and present application state

**Key Components**:

1. **Electron GUI** (`/src/renderer`)
   - HTML/CSS interface rendered in Electron window
   - JavaScript frontend (`/src/renderer/js/`)
   - Communicates via IPC (Inter-Process Communication)
   - Component-based UI management:
     - `deviceManager.js`: Device list display and interaction
     - `downloadManager.js`: Download queue visualization
     - `tabManager.js`: Multi-tab interface navigation
     - `modalManager.js`: Modal dialog handling
   - Event-driven architecture for state updates

2. **CLI/TUI Interface** (`/src/cli`)
   - Terminal-based user interface using neo-blessed
   - `CliRenderer.js`: Renders tables and UI elements in terminal
   - `CommandHandler.js`: Parses and validates CLI commands
   - `EventBridge.js`: Bridges backend events to TUI display
   - Supports commands: device management, downloads, streaming
   - Independent of Electron, can run headless

3. **Preload Bridge** (`/src/preload/preload.js`)
   - Secure Electron context bridge
   - Exposes safe API to renderer process
   - No direct Node.js access from renderer
   - IPC channel routing to main process

**Functions of Presentation Layer**:
- Display connected devices with real-time status
- Show download queue with progress bars
- Accept user commands and queries
- Render transfer progress and logs
- Provide device selection UI
- Display format selection for downloads

**Interfaces to Lower Layers**: IPC channels, Event subscriptions

---

### Layer 2: Application Layer (Orchestrators & Handlers)

**Location**: `/src/main/application`

**Responsibility**: Coordinate operations across domain and infrastructure layers, implement business workflows

**Key Components**:

1. **Orchestrators** (Workflow Controllers)

   **DeviceOrchestrator** (`/src/main/application/orchestrators/DeviceOrchestrator.js`)
   - **Responsibilities**:
     - Pair with wireless devices
     - Connect/disconnect device operations
     - Start/stop screen mirroring
     - Manage device favorites and trust status
     - Device lifecycle management
   - **Input**: User commands from presentation layer
   - **Output**: Device state updates to domain layer
   - **Dependencies**: DeviceRegistry, ConnectionService, ScrcpyAdapter

   **DownloadOrchestrator** (`/src/main/application/orchestrators/DownloadOrchestrator.js`)
   - **Responsibilities**:
     - Inspect media URLs for available formats
     - Initiate downloads with format selection
     - Track download lifecycle
     - Stop or resume downloads
     - Decide whether to start new, resume existing, or prevent duplicate downloads
     - Prevent duplicate downloads by checking in-memory state
   - **Principle**: Memory is single source of truth during runtime
   - **Output**: Download state changes
   - **Dependencies**: YtdlpAdapter, DeviceRegistry, DownloadManager

   **TransferOrchestrator** (`/src/main/application/orchestrators/TransferOrchestrator.js`)
   - **Responsibilities**:
     - Coordinate file transfer to selected devices
     - Check device storage space before transfer
     - Delete files on devices after successful transfer
     - Monitor transfer progress
     - Retry failed transfers
     - Clean up temporary files
   - **Output**: Transfer state updates
   - **Dependencies**: AdbPushService, SpaceChecker, FileDeleter, DeviceRegistry

2. **Event Handlers**

   **DeviceEventHandler** (`/src/main/application/handlers/DeviceEventHandler.js`)
   - Manages device connection/disconnection events
   - Updates device state in registry
   - Synchronizes state with UI
   - Triggers related operations on state changes

**Functions of Application Layer**:
- Implement use case workflows (download, transfer, stream)
- Validate business rules before delegating to infrastructure
- Coordinate multiple infrastructure services
- Maintain consistency across domain entities
- Handle error cases and recovery logic

**Layer Relationships**:
- Consumes: Domain entities and value objects
- Calls: Infrastructure services and adapters
- Updates: Domain state through repositories
- Communicates: With presentation via IPC and events

---

### Layer 3: Domain Layer (Business Logic & Entities)

**Location**: `/src/main/domain`

**Responsibility**: Encapsulate core business logic, define entities and value objects

**Key Components**:

1. **Entities** (Business Objects with Identity)

   **Device** (`/src/main/domain/entities/Device.js`)
   - Represents an Android device
   - Properties:
     - `id`: Unique identifier (serial or TCP address)
     - `deviceFriendlyName`: ADB-friendly name
     - `model`: Device model name
     - `version`: Android version
     - `arch`: CPU architecture
     - `isFavorite`: User preference flag
     - `isTrusted`: Device trust status
     - `customName`: User-set custom name
   - Allows controlled updates to details after connection
   - Immutability for core identity properties
   - Inherits from `BaseNode`

   **BaseFile** (`/src/main/domain/entities/BaseFile.js`)
   - Abstract base for downloaded files
   - Properties: id, title, size, format, status, source URL
   - Supports file operations and state transitions

   **VideoFile** (`/src/main/domain/entities/VideoFile.js`)
   - Specializes BaseFile for video content
   - Adds video-specific properties (resolution, fps, codec)

   **AudioFile** (`/src/main/domain/entities/AudioFile.js`)
   - Specializes BaseFile for audio content
   - Adds audio-specific properties (bitrate, sample rate)

   **HttpFile** (`/src/main/domain/entities/HttpFile.js`)
   - Represents files downloadable from HTTP/HTTPS
   - Tracks download metadata and format information

   **MediaNode** (`/src/main/domain/entities/MediaNode.js`)
   - Abstract base for media containers
   - Represents hierarchical media organization

   **BaseNode** (`/src/main/domain/entities/BaseNode.js`)
   - Root entity providing common identity properties
   - Supplies toJSON/fromJSON serialization

2. **Value Objects** (Immutable Business Values)

   **FileStatus** (`/src/main/domain/value-objects/FileStatus.js`)
   - Enum-like value object for file states
   - States: PENDING, DOWNLOADING, DOWNLOADED, TRANSFERRED, FAILED
   - Encapsulates state transition rules

**Functions of Domain Layer**:
- Define business entities and their relationships
- Encapsulate business rules in entity methods
- Provide value objects for immutable cross-cutting values
- Maintain data consistency and invariants
- Independent of any framework or tool

**No External Dependencies**: Domain layer never imports from infrastructure or application layers

---

### Layer 4: Infrastructure Layer (Technical Implementation)

**Location**: `/src/main/infrastructure`

**Responsibility**: Implement technical operations, wrap external tools, provide concrete services

**Major Components**:

1. **ADB (Android Device Bridge) Integration**
   - **Directory**: `/src/main/infrastructure/adb`
   - **Components**:
     - `AdbCommandExecutor`: Executes ADB shell commands on devices
     - `ConnectionService`: Manages device connections via ADB
     - Abstracts ADB protocol complexity
   - **Functions**: Connect devices, query device info, push files, execute commands

2. **Media Download Adapter**
   - **Directory**: `/src/main/infrastructure/media`
   - **Components**:
     - `YtdlpAdapter`: Wraps yt-dlp tool for media downloading
     - `DownloadManager`: In-memory download state tracker
     - `MetadataExtractor`: Parses media format information
     - `CompletionHandler`: Processes completed downloads
     - `ProcessManager`: Manages yt-dlp process lifecycle
     - `YtdlpUtils`: Helper utilities for format parsing
   - **Functions**: 
     - Extract metadata from URLs
     - List available formats
     - Download media with format selection
     - Track download progress
     - Trigger post-download operations

3. **File Transfer**
   - **Directory**: `/src/main/infrastructure/transfer`
   - **Components**:
     - `AdbPushService`: Orchestrates file pushing to devices
     - `FileTransferExecutor`: Executes actual ADB push command
     - `TransferProgressTracker`: Monitors transfer progress
     - `FileDeleter`: Removes files from devices
     - `SpaceChecker`: Validates device storage capacity
     - `TransferStateManager`: In-memory transfer state tracker
   - **Functions**: Push files, delete files, check space, track progress

4. **Stream/Screen Mirroring**
   - **Directory**: `/src/main/infrastructure/streaming`
   - **Components**:
     - `ScrcpyAdapter`: Wraps scrcpy tool for screen mirroring
   - **Functions**: Start/stop screen mirroring, manage scrcpy process

5. **Persistent Storage**
   - **Directory**: `/src/main/infrastructure/persistence`
   - **Components**:
     - `DatabaseManager`: SQLite database lifecycle management
     - **Repositories** (`/persistence/repositories`):
       - `DeviceRepository`: Persist device metadata
       - `DownloadRepository`: Store download history
     - **Migrations** (`/persistence/migrations`):
       - Schema versioning and updates
   - **Functions**: Create/read/update device and download records

6. **Process Management**
   - **Directory**: `/src/main/infrastructure/process`
   - **Components**:
     - `ProcessManager`: Wrapper around Node.js child_process
     - Handles process spawning and termination
   - **Functions**: Launch external processes (ADB, yt-dlp, scrcpy)

7. **Logging and Error Handling**
   - **Directory**: `/src/main/infrastructure/logging`
   - **Components**:
     - `ErrorCentralService`: Centralized error logging
     - Logs to file and console
   - **Functions**: Error tracking, log file management

8. **Path Management**
   - **Directory**: `/src/main/infrastructure/path`
   - **Components**:
     - `PathService`: Application path resolution
     - Abstracts OS-specific path handling
   - **Functions**: Resolve application, data, and resource directories

9. **Tool Resolution**
   - **Directory**: `/src/main/infrastructure/tools`
   - **Components**:
     - `ToolPathResolver`: Find system/bundled tools (yt-dlp, ADB, scrcpy)
     - `YtdlpUpdater`: Check for yt-dlp updates
   - **Functions**: Locate executable paths, validate tool availability

10. **Synchronization Services**
    - **Directory**: `/src/main/infrastructure/sync`
    - **Components**:
      - `DeviceStateSyncService`: Periodic device state synchronization (1s)
      - `DownloadStateSyncService`: Rapid download progress sync (300ms)
      - `TransferStateSyncService`: File transfer progress sync (300ms)
      - `DownloadSyncService`: Memory-to-database sync for downloads
    - **Pattern**: Reads state from memory, periodically updates UI and database

11. **IPC Communication**
    - **Directory**: `/src/main/infrastructure/ipc`
    - **Components**:
      - `DeviceHandlers`: IPC handlers for device operations
      - `DownloadHandlers`: IPC handlers for download operations
      - `TransferHandlers`: IPC handlers for transfer operations
      - `FilePickerHandler`: Local file selection dialog

**Functions of Infrastructure Layer**:
- Wrap external tools (ADB, yt-dlp, scrcpy)
- Handle OS-specific operations
- Manage database persistence
- Provide logging and error handling
- Manage process lifecycle
- Implement synchronization with UI

**Dependencies**: Domain layer, external tools, Node.js APIs

---

### Layer 5: Runtime Layer (State Management & Process Supervision)

**Location**: `/src/main/runtime`

**Responsibility**: Manage application runtime state, supervise process execution

**Key Components**:

1. **Device Management**
   - **Directory**: `/src/main/runtime/devices`
   - **Components**:
     - `DeviceRegistry`: In-memory device registry
       - Maintains connected devices
       - Tracks device runtime state (connected, offline)
       - Provides device lookup and filtering
     - `DeviceRuntimeState`: Device state during runtime
       - Current connection status
       - Streaming status
       - Device capabilities
   - **Pattern**: Registry pattern for device collection

2. **Process Supervision**
   - **Directory**: `/src/main/runtime/processes`
   - **Components**:
     - `ProcessRegistry`: Track all supervised processes
       - Child processes spawned by the application
       - ADB, yt-dlp, scrcpy processes
       - Process IDs and metadata
     - `ProcessSupervisor`: Manages process lifecycle
       - Spawn processes
       - Monitor execution
       - Terminate on demand
       - Handle process errors
   - **Pattern**: Supervisor pattern for reliability

**Functions of Runtime Layer**:
- Maintain registry of connected devices
- Track process execution
- Provide runtime statistics
- Handle cleanup and shutdown

**Lifecycle**: Created at application start, maintained throughout runtime, cleaned at shutdown

---

### Layer Relationships & Data Flow

#### Typical Request Flow (Example: Download Video)

```
1. USER INPUT (Presentation)
   └─> Click "Download" button, select device, enter URL
   
2. PRESENTATION LAYER
   └─> Render UI form, validate inputs
   
3. IPC BRIDGE
   └─> Send message to main process
   
4. APPLICATION LAYER
   └─> DownloadOrchestrator.startDownload()
       - Apply business rules
       - Check for duplicates
       - Prepare options
   
5. INFRASTRUCTURE LAYER
   └─> YtdlpAdapter.downloadMedia()
       - Spawn yt-dlp process
       - Monitor progress
       - Save file
   
6. DOMAIN LAYER
   └─> Create/update VideoFile entity
       - Validate state transitions
       - Calculate metadata
   
7. PERSISTENCE
   └─> Save download record to SQLite
   
8. RUNTIME
   └─> Update process registry
   └─> Update download state in memory
   
9. SYNC SERVICE (300ms loop)
   └─> DeviceStateSyncService reads state
   └─> Send updates via IPC
   
10. PRESENTATION LAYER
    └─> Receive IPC event
    └─> Update UI display
```

---

## Project Scope and Use Cases

### Scope Definition

#### In Scope (Core Features)

1. **Device Management**
   - USB device connection detection and management
   - Device information retrieval (model, version, architecture)
   - Device trust and favorite status management
   - Multiple simultaneous device connections
   - Device state persistence

2. **Media Download**
   - Download videos from web sources
   - Download audio/music from various platforms
   - Format and quality selection
   - Download progress tracking
   - Retry on failure
   - Download history tracking

3. **Content Transfer**
   - Transfer downloaded media to connected Android devices
   - Device storage space validation
   - Multi-device distribution (select multiple targets)
   - Transfer progress monitoring
   - File cleanup after successful transfer
   - Transfer history and statistics

4. **User Interface**
   - Desktop GUI for interactive operations
   - CLI/TUI for headless/server scenarios
   - Real-time state synchronization
   - Device and download status displays
   - Format selection modals
   - Device selection modals

5. **Data Persistence**
   - Device registry with metadata
   - Download history
   - User preferences (favorites, custom names)
   - Transfer logs

6. **Process Management**
   - Lifecycle management of external processes
   - Graceful shutdown and cleanup
   - Error recovery and retry logic
   - Process resource monitoring

#### Out of Scope (Intentionally Excluded)

- Wireless device pairing (ignored per user requirements)
- Network connectivity features
- Device-side application installation
- Mobile app development
- Media stream playback
- Backend server deployment

### Use Cases

#### Use Case 1: Connect USB Device
**Actors**: User, LinkHub Application, Android Device via USB
**Flow**:
1. User plugs Android device via USB
2. Application detects device via ADB
3. Application queries device information
4. Device appears in device list
5. User can interact with device

**Key Components**: 
- `AdbCommandExecutor` - Execute ADB detect command
- `DeviceOrchestrator` - Process connection
- `DeviceRegistry` - Store device state
- UI - Display in device list

#### Use Case 2: Download and Transfer Media
**Actors**: User, LinkHub Application, Internet Server, Android Device
**Flow**:
1. User enters media URL (YouTube, Soundcloud, etc.)
2. Application extracts metadata and format list
3. User selects desired format and quality
4. Application initiates download to local storage
5. Application monitors download progress
6. Upon completion, application transfers to selected device
7. Device space checked before transfer
8. File transferred via ADB push
9. Source file cleaned after successful transfer
10. Download record persisted

**Key Components**:
- `YtdlpAdapter` - Handle media download
- `DownloadOrchestrator` - Coordinate workflow
- `TransferOrchestrator` - Manage transfer
- `AdbPushService` - Execute transfer
- `DeviceRegistry` - Target device selection

#### Use Case 3: Monitor Multiple Downloads
**Actors**: User, LinkHub Application
**Flow**:
1. User queues multiple media downloads
2. Application downloads in parallel
3. Progress indicators updated for each download
4. User can stop individual downloads
5. Failed downloads can be retried
6. Completed downloads automatically transfer

**Key Components**:
- `DownloadManager` - Track multiple downloads
- `DownloadStateSyncService` - Rapid UI updates (300ms)
- UI display - Show progress bars and statistics

#### Use Case 4: CLI-based Automation
**Actors**: Script/User Command Line, LinkHub CLI
**Flow**:
1. User types CLI command: `download <url> <device#>`
2. CLI renderer displays available commands and devices
3. CLI processes command through CommandHandler
4. Operations execute without GUI
5. Results displayed in terminal

**Key Components**:
- `CliRenderer` - Terminal UI rendering
- `CommandHandler` - Parse commands
- `EventBridge` - Backend to TUI event mapping

### Supported Operations

**Device Operations**:
- List connected devices
- Connect to USB/TCP-IP devices
- Disconnect devices
- Mark as favorite
- Set trust status
- Set custom device name
- Start screen mirroring
- Stop screen mirroring

**Download Operations**:
- Inspect media URL (get metadata and formats)
- Start download with format selection
- Monitor progress
- Pause/resume downloads
- Stop downloads
- View download history

**Transfer Operations**:
- Select target devices
- Transfer completed downloads
- Check device storage
- Delete files from devices
- Monitor transfer progress

---

## Technology Stack

### Runtime Environment

| Component | Version/Type | Purpose |
|-----------|-------------|---------|
| **Electron** | 30.0.0 | Desktop application framework for cross-platform GUI |
| **Node.js** | LTS (via Electron) | JavaScript runtime for backend logic |
| **JavaScript** | ES6+ | Primary programming language |

### Desktop Framework & GUI

| Component | Version | Purpose |
|-----------|---------|---------|
| **Electron** | 30.0.0 | Desktop application container |
| **Electron Builder** | 24.13.3 | Build and package for distribution |
| **Electron Rebuild** | 3.6.0 | Rebuild native modules for Electron |
| **Electron Log** | 5.4.4 | Electron-specific logging |
| **Electron Squirrel Startup** | 1.0.1 | Windows installer handler |

### CLI/Terminal UI

| Component | Version | Purpose |
|-----------|---------|---------|
| **neo-blessed** | 0.2.0 | Terminal UI framework for CLI interface |
| **chalk** | 4.1.2 | Colored terminal output for logs and messages |

### Database

| Component | Version | Purpose |
|-----------|---------|---------|
| **better-sqlite3** | 12.10.0 | Synchronous SQLite driver for Node.js |

### External Tools Integration

| Tool | Version | Purpose | Integration |
|------|---------|---------|-------------|
| **ADB (Android Device Bridge)** | System | Device communication protocol | Via process execution |
| **yt-dlp** | Latest | Media download from web sources | `YtdlpAdapter` wrapper |
| **scrcpy** | Latest | Screen mirroring and device control | `ScrcpyAdapter` wrapper |

### HTTP & Networking

| Component | Version | Purpose |
|-----------|---------|---------|
| **axios** | 1.16.1 | HTTP client for API calls and downloads |
| **bonjour-service** | 1.4.0 | mDNS service discovery (for device discovery scenarios) |

### Configuration & Environment

| Component | Version | Purpose |
|-----------|---------|---------|
| **dotenv** | 17.4.2 | Environment variable management |

### Testing & Quality

| Framework | Version | Purpose |
|-----------|---------|---------|
| **Jest** | 30.4.2 | Unit and integration testing framework |
| **jest.config.js** | Custom | Jest configuration for unit tests |
| **jest.e2e.config.js** | Custom | Jest configuration for end-to-end tests |
| **memfs** | 4.0.0 | In-memory file system for testing |

### Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **npm** | (bundled) | Package manager and build script runner |
| **electron-rebuild** | 3.6.0 | Rebuild native modules |

### Available Scripts

```json
{
  "test": "Run unit tests with garbage collection",
  "test:coverage": "Generate test coverage reports",
  "test:e2e": "Run end-to-end tests",
  "test:e2e:headless": "Run E2E tests in headless mode",
  "start": "Launch Electron application",
  "postinstall": "Install app dependencies for Electron",
  "rebuild": "Rebuild native modules",
  "build": "Build Linux distribution (AppImage, deb)",
  "cli": "Run CLI interface",
  "download": "Run CLI download script"
}
```

### Architecture-Level Technology Decisions

| Layer | Technologies | Rationale |
|-------|-------------|-----------|
| **Presentation** | Electron, HTML/CSS/JS | Cross-platform desktop UI, web standards |
| **Presentation (CLI)** | neo-blessed, chalk | Terminal UI without external dependencies |
| **Application** | Pure JavaScript classes | Clean separation, dependency injection |
| **Domain** | Pure JavaScript objects | No framework coupling, DDD principles |
| **Infrastructure** | Axios, Node.js APIs | HTTP, system operations, process management |
| **Persistence** | SQLite, better-sqlite3 | Lightweight, reliable, file-based storage |
| **Logging** | electron-log, custom | Structured logging, Electron integration |
| **Testing** | Jest | Comprehensive testing, mocking support |

### External Dependencies Matrix

```
Application Functionality ← Technology Stack ← External Requirements
     ↓
Device Management ─────→ ADB (Android Device Bridge)
                         [System tool, not bundled]

Media Download ────────→ yt-dlp [Bundled/System]
                         HTTP requests via axios

Screen Mirroring ──────→ scrcpy [System tool]
                         Network connectivity

File Transfer ─────────→ ADB via FileTransferExecutor
                         Device storage capability

Desktop UI ────────────→ Electron Framework
                         Operating System APIs

CLI Interface ─────────→ neo-blessed Library
                         Terminal/Console
```

### Development & Build Ecosystem

- **Package Manager**: npm (with npm-ci for CI/CD)
- **Version Control**: Git
- **Build Automation**: npm scripts (package.json)
- **Distribution**: electron-builder (Linux AppImage, Debian packages)
- **Environment Config**: .env files via dotenv

### Technology Rationale

1. **Electron**: Provides unified desktop application development for Linux, macOS, and Windows with web technologies
2. **Node.js**: Rich ecosystem, excellent process management and file system APIs
3. **SQLite**: Lightweight persistence without database server requirements
4. **yt-dlp**: Most reliable and feature-rich media download tool with broad platform support
5. **ADB**: Standard Android device communication protocol
6. **scrcpy**: Lightweight, efficient screen mirroring without root access
7. **neo-blessed**: Terminal UI without heavy dependencies (suitable for headless deployment)
8. **Jest**: Mature testing framework with excellent mocking and coverage reporting

---

## Summary

**LinkHub** is a sophisticated desktop application demonstrating professional software architecture principles. It cleanly separates concerns across five layers (Presentation, Application, Domain, Infrastructure, Runtime) while maintaining cohesive integration between layers. 

The architecture supports multiple user interfaces (GUI and CLI), robust external tool integration, comprehensive error handling, and persistent state management. The technology stack is pragmatic, choosing lightweight but capable tools that integrate well with Electron and Node.js.

The project exhibits clean code practices including dependency injection, single responsibility principle, clear separation of concerns, and testable design patterns. Business logic resides in domain and application layers, insulated from framework and tool specifics through adapter patterns.

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-10  
**Project**: LinkHub Desktop Application  
**Author**: AI Documentation Assistant
