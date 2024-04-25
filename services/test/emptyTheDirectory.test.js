const fs = require("fs-extra");
const { describe, it, expect, beforeEach, afterEach } = require("vitest");
const { emptyTheDirectory } = require("../emptyTheDirectory");
const logger = require("../lib/logger");

describe("emptyTheDirectory", () => {
  const testDirectoryPath = "./test/testDirectory";

  beforeEach(async () => {
    await fs.ensureDir(testDirectoryPath);
    await fs.writeFile(`${testDirectoryPath}/file1.txt`, "Test file 1");
    await fs.writeFile(`${testDirectoryPath}/file2.txt`, "Test file 2");
  });

  afterEach(async () => {
    await fs.remove(testDirectoryPath);
  });

  it("should empty the directory and log a success message", async () => {
    const loggerInfoSpy = vi.spyOn(logger, "info");

    await emptyTheDirectory(testDirectoryPath);

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      `All files in ${testDirectoryPath} have been successfully deleted.`
    );

    const filesInDirectory = await fs.readdir(testDirectoryPath);
    expect(filesInDirectory).toHaveLength(0);

    loggerInfoSpy.mockRestore();
  });

  it("should throw an error and log an error message if emptying the directory fails", async () => {
    const loggerErrorSpy = vi.spyOn(logger, "error");
    const nonExistentDirectoryPath = "./test/nonExistentDirectory";

    await expect(
      emptyTheDirectory(nonExistentDirectoryPath)
    ).rejects.toThrowError();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      `Error deleting files in directory ${nonExistentDirectoryPath}:`,
      expect.any(Error)
    );

    loggerErrorSpy.mockRestore();
  });
});
