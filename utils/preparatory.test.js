const fs = require('fs-extra');
const logger = require('../lib/logger');
const { ensureDirectoryExists, prepareDirectory } = require('../utils/preparatory');


// Mocking fs-extra and logger
jest.mock('fs-extra', () => ({
	pathExists: jest.fn(),
	ensureDir: jest.fn(),
}));

jest.mock('../lib/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
}));

// Mocking dependencies
jest.mock('./preparatory', () => ({
	ensureDirectoryExists: jest.fn()
}));


describe('prepareDirectory', () => {
	beforeEach(() => {
		jest.clearAllMocks(); // Clear mocks between tests
	});

	it('ensures all specified directories are created', async () => {
		// Setup ensureDirectoryExists to resolve for all calls
		ensureDirectoryExists.mockResolvedValue();

		const configPath = {
			sourceZipDirectory: '/path/to/source',
			destinationZipDirectory: '/path/to/destination',
			miscErrorDirectory: '/path/to/misc/errors',
			dbInsertionErrorDirectory: '/path/to/db/errors',
			fieldConfigErrorDirectory: '/path/to/field/config/errors'
		};

		await prepareDirectory(configPath);

		// Check that ensureDirectoryExists was called for each directory
		expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to/source');
		expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to/destination');
		expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to/misc/errors');
		expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to/db/errors');
		expect(ensureDirectoryExists).toHaveBeenCalledWith('/path/to/field/config/errors');
	});

	it('throws and logs an error if any directory creation fails', async () => {
		// Setup ensureDirectoryExists to throw an error for one of the calls
		const error = new Error('Failed to create directory');
		ensureDirectoryExists.mockResolvedValueOnce(); // First call succeeds
		ensureDirectoryExists.mockRejectedValueOnce(error); // Second call fails

		const configPath = {
			sourceZipDirectory: '/path/to/source',
			destinationZipDirectory: '/path/to/destination',
			miscErrorDirectory: '/path/to/misc/errors',
			dbInsertionErrorDirectory: '/path/to/db/errors',
			fieldConfigErrorDirectory: '/path/to/field/config/errors'
		};

		await expect(prepareDirectory(configPath)).rejects.toThrow('Failed to create directory');

		// Verify that the error was logged
		expect(logger.error).toHaveBeenCalledWith('Error preparing the environment:', error);
	});
});

describe('ensureDirectoryExists', () => {

	beforeEach(() => {
		jest.clearAllMocks(); // Reset all mocks before each test
	});

	it('creates the directory if it does not exist', async () => {
		fs.pathExists.mockResolvedValue(false);
		fs.ensureDir.mockResolvedValue(undefined);

		await ensureDirectoryExists('/fake/path');

		expect(fs.pathExists).toHaveBeenCalledWith('/fake/path');
		expect(fs.ensureDir).toHaveBeenCalledWith('/fake/path');
		expect(logger.info).toHaveBeenCalledWith('Directory created: /fake/path');
	});

	it('does nothing if the directory already exists', async () => {
		fs.pathExists.mockResolvedValue(true);

		await ensureDirectoryExists('/fake/path');

		expect(fs.pathExists).toHaveBeenCalledWith('/fake/path');
		expect(fs.ensureDir).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith('Verify Directory: /fake/path, CHECKED!');
	});

	it('logs and throws an error if ensuring directory existence fails', async () => {
		fs.pathExists.mockResolvedValue(false);
		const error = new Error('Failed to ensure directory');
		fs.ensureDir.mockRejectedValue(error);

		await expect(ensureDirectoryExists('/fake/path')).rejects.toThrow('Failed to ensure directory');
		expect(logger.error).toHaveBeenCalledWith('Error ensuring directory exists: /fake/path', error);
	});
});
