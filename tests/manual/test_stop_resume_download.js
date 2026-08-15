// test_stop_resume_download.js
// Manual test for stop and resume download functionality
// This test simulates starting a download, stopping it, and resuming it

const TEST_VIDEO_URL = 'https://youtu.be/t_TfkRSFdNs?si=c2LLd-en8k3Iwy7U';

async function runTest() {
    console.log('=== Test Stop/Resume Download Functionality ===\n');
    
    try {
        // Step 1: Inspect the video to get formats
        console.log('Step 1: Inspecting video formats...');
        const formats = await linkhub.downloads.inspect(TEST_VIDEO_URL);
        console.log(`Found ${formats.length} formats`);
        
        // Select a good format (prefer video+audio)
        const selectedFormat = formats.find(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none') 
                               || formats.find(f => f.ext === 'mp4')
                               || formats[0];
        
        if (!selectedFormat) {
            throw new Error('No suitable format found');
        }
        
        console.log(`Selected format: ${selectedFormat.id} (${selectedFormat.ext}, ${selectedFormat.resolution || 'audio'})\n`);
        
        // Step 2: Start download
        console.log('Step 2: Starting download...');
        const downloadResult = await linkhub.downloads.start(
            TEST_VIDEO_URL,
            selectedFormat.id,
            null, // deviceId (local)
            { title: 'Test Video - Stop/Resume' }
        );
        
        const processId = downloadResult.processId;
        console.log(`Download started with ID: ${processId}\n`);
        
        // Step 3: Wait for download to progress
        console.log('Step 3: Waiting for download to progress (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('Download should have progressed\n');
        
        // Step 4: Stop the download
        console.log('Step 4: Stopping the download...');
        const stopResult = await linkhub.downloads.stop(processId);
        console.log(`Stop result: ${stopResult ? 'Success' : 'Failed'}\n`);
        
        // Step 5: Wait a moment
        console.log('Step 5: Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Wait complete\n');
        
        // Step 6: Resume the download
        console.log('Step 6: Resuming the download...');
        const resumeResult = await linkhub.downloads.resume(
            processId,
            TEST_VIDEO_URL,
            selectedFormat.id,
            null, // deviceId
            { title: 'Test Video - Stop/Resume' }
        );
        console.log(`Resume result: ${resumeResult ? 'Success' : 'Failed'}\n`);
        
        // Step 7: Wait for download to progress again
        console.log('Step 7: Waiting for resumed download to progress (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('Resumed download should have progressed\n');
        
        // Step 8: Stop the download again to clean up
        console.log('Step 8: Stopping download to clean up...');
        await linkhub.downloads.stop(resumeResult.processId || processId);
        console.log('Download stopped\n');
        
        console.log('=== Test Completed Successfully ===');
        console.log('Expected behavior:');
        console.log('- Download should start without errors');
        console.log('- Download should stop without showing "failed" status');
        console.log('- Stop button should change to "resume" (استئناف)');
        console.log('- Resume should work without "insufficient data" error');
        console.log('- No GLib-GObject errors should appear in console');
        
    } catch (error) {
        console.error('=== Test Failed ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
runTest().then(() => {
    console.log('\nTest finished. Check the UI for correct behavior.');
    process.exit(0);
}).catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
