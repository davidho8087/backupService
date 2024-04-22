// At the top of your test file
jest.mock('fs-extra', () => ({
    emptyDir: jest.fn().mockResolvedValue()
}));

jest.mock('../../lib/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

const fs = require('fs-extra');
const logger = require('../../lib/logger');
const { emptyTheDirectory } = require('../emptyTheDirectory'); // Adjust the path accordingly

describe('emptyTheDirectory', () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Reset all mocks before each test
        fs.emptyDir.mockResolvedValue(); // Ensure mock is reset with resolved value as default for each test
    });

    it('should successfully empty the directory and log a message', async () => {
        const directoryPath = '/path/to/directory';
        await emptyTheDirectory(directoryPath);
        expect(fs.emptyDir).toHaveBeenCalledWith(directoryPath);
        expect(logger.info).toHaveBeenCalledWith(`All files in ${directoryPath} have been successfully deleted.`);
    });

    it('should log an error and throw when failing to empty the directory', async () => {
        const error = new Error('Failed to empty directory');
        fs.emptyDir.mockRejectedValue(error); // Simulate an error

        const directoryPath = '/path/to/directory';
        await expect(emptyTheDirectory(directoryPath)).rejects.toThrow('Failed to empty directory');
        expect(fs.emptyDir).toHaveBeenCalledWith(directoryPath);
        expect(logger.error).toHaveBeenCalledWith(`Error deleting files in directory ${directoryPath}:`, error);
    });
});
