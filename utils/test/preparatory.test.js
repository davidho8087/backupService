const fs = require('fs-extra');
const logger = require('../../lib/logger');
const prisma = require("../../lib/prismaClient");
const { ensureDirectoryExists, prepareDirectory, testPrismaConnection} = require('../preparatory');



// Mocking fs-extra and logger
jest.mock('fs-extra', () => ({
	pathExists: jest.fn(() => Promise.resolve(false)),
	ensureDir: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../lib/logger', () => ({
	info: jest.fn(),
	error: jest.fn(),
}));



describe('ensureDirectoryExists', () => {
	beforeEach(() => {
		jest.clearAllMocks(); // Reset mocks before each test
	});

	it('creates the directory if it does not exist', async () => {
		// Setup
		fs.pathExists.mockResolvedValue(false);
		fs.ensureDir.mockResolvedValue();

		// Action
		await ensureDirectoryExists('/fake/path');

		// Assertions
		expect(fs.pathExists).toHaveBeenCalledWith('/fake/path');
		expect(fs.ensureDir).toHaveBeenCalledWith('/fake/path');
		expect(logger.info).toHaveBeenCalledWith('Directory created: /fake/path');
	});

	it('does nothing if the directory already exists', async () => {
		// Setup
		fs.pathExists.mockResolvedValue(true);

		// Action
		await ensureDirectoryExists('/fake/path');

		// Assertions
		expect(fs.pathExists).toHaveBeenCalledWith('/fake/path');
		expect(fs.ensureDir).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith('Verify Directory: /fake/path, CHECKED!');
	});

	it('logs and throws an error if an error occurs', async () => {
		// Setup
		const error = new Error('Filesystem error');
		fs.pathExists.mockRejectedValue(error);

		// Action & Assertions
		await expect(ensureDirectoryExists('/fake/path')).rejects.toThrow('Filesystem error');
		expect(logger.error).toHaveBeenCalledWith('Error ensuring directory exists: /fake/path', error);
	});
});