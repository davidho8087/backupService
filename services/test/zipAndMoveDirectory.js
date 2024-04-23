// Mocking dependencies at the top of the test file
jest.mock("fs-extra", () => ({
  move: jest.fn(),
  promises: {
    readdir: jest.fn(),
  },
  createWriteStream: jest.fn(),
}));
jest.mock("../../lib/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock("path", () => ({
  join: jest.fn(),
}));
jest.mock("archiver", () => {
  const mockArchiver = {
    on: jest.fn((event, handler) => {
      if (event === "close") setTimeout(() => handler(), 0);
      return mockArchiver;
    }),
    pipe: jest.fn(() => mockArchiver),
    glob: jest.fn(),
    finalize: jest.fn(),
  };
  return jest.fn(() => mockArchiver);
});
jest.mock("../utils/preparatory", () => ({
  ensureDirectoryExists: jest.fn(),
}));

const fs = require("fs-extra");
const path = require("path");
const logger = require("../../lib/logger");
const {
  zipAndMoveDirectory,
  moveZipFile,
  zipTheDirectory,
} = require("./zipAndMoveDirectory");
const { ensureDirectoryExists } = require("../utils/preparatory");

// Import the function you are testing
const { moveZipFile } = require("../path_to/moveZipFile"); // Adjust the import path accordingly

describe("moveZipFile", () => {
  beforeEach(() => {
    // Clear all mock instances and calls before each test
    jest.clearAllMocks();
  });

  it("should successfully move the zip file and log the operation", async () => {
    // Setup - Define your test input and expected outputs
    const sourcePath = "/fake/source/path.zip";
    const destinationPath = "/fake/destination/path.zip";

    // Mock the `fs.move` function to simulate a successful move
    fs.move.mockResolvedValue();

    // Act - Call the function with the test input
    await moveZipFile(sourcePath, destinationPath);

    // Assert - Check if the right interactions and outputs have occurred
    expect(fs.move).toHaveBeenCalledWith(sourcePath, destinationPath); // Check if fs.move was called correctly
    expect(logger.info).toHaveBeenCalledWith(
      `Zip file moved to: ${destinationPath}`
    ); // Ensure that success is logged
  });

  it("should log an error and throw when the file cannot be moved", async () => {
    // Setup - Define paths and the error to be thrown
    const sourcePath = "/fake/source/path.zip";
    const destinationPath = "/fake/destination/path.zip";
    const moveError = new Error("Failed to move file");

    // Mock the `fs.move` to simulate an error scenario
    fs.move.mockRejectedValue(moveError);

    // Act & Assert - Ensure the function throws an error and the error handling is correct
    await expect(moveZipFile(sourcePath, destinationPath)).rejects.toThrow(
      moveError
    ); // Check if the function throws the error
    expect(fs.move).toHaveBeenCalledWith(sourcePath, destinationPath); // Verify fs.move was called with correct parameters
    expect(logger.error).toHaveBeenCalledWith(
      "Error moving zip file:",
      moveError
    ); // Confirm that error is logged
  });
});

describe("zipTheDirectory", () => {
  const sourceZipDirectory = "/fake/source";

  beforeEach(() => {
    jest.clearAllMocks();
    path.join.mockReturnValue("/fake/source/../backup.zip");
  });

  it("successfully zips a directory with files", async () => {
    fs.promises.readdir.mockResolvedValue(["file1.txt", "file2.txt"]);
    fs.createWriteStream.mockReturnValue({});

    const result = await zipTheDirectory(sourceZipDirectory);

    expect(fs.promises.readdir).toHaveBeenCalledWith(sourceZipDirectory);
    expect(archiver).toHaveBeenCalledWith("zip", { zlib: { level: 9 } });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Folder zipped successfully")
    );
    expect(result).toEqual("/fake/source/../backup.zip");
  });

  it("returns null if the directory is empty", async () => {
    fs.promises.readdir.mockResolvedValue([]);

    const result = await zipTheDirectory(sourceZipDirectory);

    expect(fs.promises.readdir).toHaveBeenCalledWith(sourceZipDirectory);
    expect(logger.info).toHaveBeenCalledWith(
      "No files left to zip after moving erroneous files."
    );
    expect(result).toBeNull();
  });

  it("handles archiver errors correctly", async () => {
    fs.promises.readdir.mockResolvedValue(["file1.txt", "file2.txt"]);
    fs.createWriteStream.mockReturnValue({});
    const error = new Error("Archiving failed");
    const archiverInstance = archiver();
    archiverInstance.on.mockImplementation((event, handler) => {
      if (event === "error") handler(error);
      return archiverInstance;
    });

    await expect(zipTheDirectory(sourceZipDirectory)).rejects.toThrow(
      "Archiving failed"
    );
    expect(logger.error).toHaveBeenCalledWith("Archiver error:", error);
  });
});

describe("zipAndMoveDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureDirectoryExists.mockResolvedValue();
    zipTheDirectory.mockResolvedValue("/path/to/source/backup.zip");
    moveZipFile.mockResolvedValue();
  });

  it("should ensure the destination directory exists and perform zip and move operations", async () => {
    await zipAndMoveDirectory("/path/to/source", "/path/to/destination");

    expect(ensureDirectoryExists).toHaveBeenCalledWith("/path/to/destination");
    expect(zipTheDirectory).toHaveBeenCalledWith("/path/to/source");
    expect(moveZipFile).toHaveBeenCalledWith(
      "/path/to/source/backup.zip",
      "/path/to/destination/backup.zip"
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Folder zipping and moving completed."
    );
  });

  it("should handle the case where the source directory is empty", async () => {
    zipTheDirectory.mockResolvedValue(null);
    await zipAndMoveDirectory("/path/to/source", "/path/to/destination");

    expect(zipTheDirectory).toHaveBeenCalledWith("/path/to/source");
    expect(logger.info).toHaveBeenCalledWith(
      "Not require to create a zip file as the folder is empty."
    );
    expect(moveZipFile).not.toHaveBeenCalled();
  });

  it("should handle errors during the zipping and moving process", async () => {
    const error = new Error("Zipping failed");
    zipTheDirectory.mockRejectedValue(error);
    await zipAndMoveDirectory("/path/to/source", "/path/to/destination");

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to zip folder or move zip file:",
      error
    );
    expect(moveZipFile).not.toHaveBeenCalled();
  });
});
