// navbarManager.js - Controls responsive navbar behavior

const MOBILE_BREAKPOINT = 850;

/**
 * Initializes the responsive navbar.
 */
export function initNavbar() {
    const navbar = document.querySelector('.navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = navbar?.querySelector('.nav-links');
    const navItems = navLinks?.querySelectorAll('.nav-item');

    if (!navbar || !navToggle || !navLinks) {
        console.warn('[navbarManager] Navbar elements were not found.');
        return;
    }

    /**
     * Returns whether the navigation menu is open.
     */
    const isMenuOpen = () => navbar.classList.contains('nav-open');

    /**
     * Opens the navigation menu.
     */
    const openMenu = () => {
        navbar.classList.add('nav-open');

        navToggle.setAttribute('aria-expanded', 'true');
        navToggle.setAttribute('aria-label', 'إغلاق قائمة التنقل');
    };

    /**
     * Closes the navigation menu.
     */
    const closeMenu = () => {
        navbar.classList.remove('nav-open');

        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'فتح قائمة التنقل');
    };

    /**
     * Toggles the navigation menu.
     */
    const toggleMenu = () => {
        if (isMenuOpen()) {
            closeMenu();
            return;
        }

        openMenu();
    };

    /**
     * Handles the hamburger button click.
     */
    const handleToggleClick = (event) => {
        event.preventDefault();
        event.stopPropagation();

        toggleMenu();
    };

    /**
     * Closes the menu when clicking outside the navbar.
     */
    const handleDocumentClick = (event) => {
        if (!isMenuOpen()) {
            return;
        }

        if (!navbar.contains(event.target)) {
            closeMenu();
        }
    };

    /**
     * Closes the menu using the Escape key.
     */
    const handleDocumentKeydown = (event) => {
        if (event.key !== 'Escape' || !isMenuOpen()) {
            return;
        }

        closeMenu();
        navToggle.focus();
    };

    /**
     * Restores the desktop navbar when the window becomes wider.
     */
    const handleWindowResize = () => {
        if (window.innerWidth > MOBILE_BREAKPOINT) {
            closeMenu();
        }
    };

    /**
     * Closes the mobile menu after selecting a navigation item.
     */
    const handleNavItemClick = () => {
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
            closeMenu();
        }
    };

    navToggle.setAttribute('aria-expanded', 'false');

    navToggle.addEventListener('click', handleToggleClick);
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKeydown);
    window.addEventListener('resize', handleWindowResize);

    navItems?.forEach((navItem) => {
        navItem.addEventListener('click', handleNavItemClick);
    });
}
