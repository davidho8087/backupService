// Mock the fs.readdir function
jest.mock("fs-extra", () => ({
  readdir: jest.fn(),
}));

jest.mock("../../lib/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const fs = require("fs-extra");
const {
  isDirectoryNotEmpty,
  validateSchedulingConfig,
} = require("../scheduler");

describe("isDirectoryNotEmpty", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should resolve to true if the directory is not empty", async () => {
    fs.readdir.mockImplementation((path, callback) =>
      callback(null, ["file1.txt", "file2.txt"])
    ); // Mocking non-empty directory
    await expect(isDirectoryNotEmpty("some/path")).resolves.toBe(true);
  });

  it("should resolve to false if the directory is empty", async () => {
    fs.readdir.mockImplementation((path, callback) => callback(null, [])); // Mocking empty directory
    await expect(isDirectoryNotEmpty("some/path")).resolves.toBe(false);
  });

  it("should reject with an error if an error occurs", async () => {
    const error = new Error("Error reading directory");
    fs.readdir.mockImplementation((path, callback) => callback(error, null)); // Mocking an error
    await expect(isDirectoryNotEmpty("some/path")).rejects.toThrow(
      "Error reading directory"
    );
  });
});

describe("validateSchedulingConfig", () => {
  it("should validate correctly with exactly one scheduling option set (dailyAt)", () => {
    const config = { dailyAt: "13:16", everyXHours: null, everyXMinutes: null };
    expect(() => validateSchedulingConfig(config)).not.toThrow();
  });

  it("should validate correctly with exactly one scheduling option set (everyXHours)", () => {
    const config = { dailyAt: null, everyXHours: 3, everyXMinutes: null };
    expect(() => validateSchedulingConfig(config)).not.toThrow();
  });

  it("should validate correctly with exactly one scheduling option set (everyXMinutes)", () => {
    const config = { dailyAt: null, everyXHours: null, everyXMinutes: 15 };
    expect(() => validateSchedulingConfig(config)).not.toThrow();
  });

  it("should throw an error if no scheduling options are set", () => {
    const config = { dailyAt: null, everyXHours: null, everyXMinutes: null };
    expect(() => validateSchedulingConfig(config)).toThrow(
      "Invalid scheduling configuration: exactly one of 'dailyAt', 'everyXHours', or 'everyXMinutes' must be set."
    );
  });

  it("should throw an error if more than one scheduling option is set", () => {
    const config = { dailyAt: "13:16", everyXHours: 3, everyXMinutes: null };
    expect(() => validateSchedulingConfig(config)).toThrow(
      "Invalid scheduling configuration: exactly one of 'dailyAt', 'everyXHours', or 'everyXMinutes' must be set."
    );
  });

  it("should ignore other unrelated configuration properties", () => {
    const config = {
      dailyAt: null,
      everyXHours: 3,
      everyXMinutes: null,
      BATCH_SIZE: 100,
    };
    expect(() => validateSchedulingConfig(config)).not.toThrow();
  });
});
