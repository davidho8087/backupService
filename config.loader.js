const fs = require('fs');
const yaml = require('js-yaml');
const { z } = require('zod');
const path = require("path");
const logger = require('./lib/logger.js');

// Validates time in "HH:mm" format.
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const FieldMapSchema = z.object({
	spacing: z.number(),
	fields: z.array(z.string()),
});

const FileFieldMapSchema = z.record(FieldMapSchema);

const PathConfigSchema = z.object({
	isEnabled: z.boolean().default(false),
	sourceZipDirectory: z.string(),
	destinationZipDirectory: z.string(),
	miscErrorDirectory: z.string(),
	dbInsertionErrorDirectory: z.string(),
	fieldConfigErrorDirectory: z.string(),

	winstonLogDirectory: z.string(),
	runProcessFiles: z.boolean().default(false),
	runZipAndMove: z.boolean().default(false),
	runEmptyTheDirectory: z.boolean().default(false),

	BATCH_SIZE: z.number().default(100),

	dailyAt: z
		.string()
		.optional()
		.nullable()
		.refine(
			(val) => {
				return val == null || timePattern.test(val);
			},
			{
				message: 'dailyAt must be in HH:mm format',
			}
		),
	everyXHours: z
		.number()
		.optional()
		.nullable()
		.refine(
			(val) => {
				return val == null || (val >= 1 && val <= 23);
			},
			{
				message: 'everyXHours must be between 1 and 23',
			}
		),
	everyXMinutes: z
		.number()
		.optional()
		.nullable()
		.refine(
			(val) => {
				return val == null || (val >= 1 && val <= 59);
			},
			{
				message: 'everyXMinutes must be between 1 and 59',
			}
		),
	FILE_FIELD_MAP: FileFieldMapSchema,
});

const ConfigSchema = z.object({
	CLIENT_BRAND: z.string(),
	STORE_CODE: z.string(),
	HOST: z.string(),
	PORT: z.number(),
	NODE_ENV: z.string(),
	PATH_CONFIG: PathConfigSchema,
});

/**
 * Loads and validates configuration settings from a YAML file located at `./config.yaml`.
 * This function reads configuration data using the `fs` module to synchronously read the file
 * and uses the `yaml` library to parse the content. After parsing, the configuration is validated
 * against a schema defined with Zod to ensure it meets all required constraints and types.
 *
 * If the YAML content is valid according to the schema, the validated configuration object is returned.
 * If the YAML file contains validation errors, these are logged, and the process exits. If other reading
 * errors occur (e.g., file not found, bad permissions), these errors are also logged, and the process exits.
 *
 * @returns {Object} The validated configuration object parsed from the YAML file.
 * @throws {z.ZodError} If the YAML content does not meet the schema requirements, indicating validation errors.
 * @throws {Error} For file reading issues such as "file not found" or "bad permissions".
 */
function loadYAMLConfig() {
	const basePath = process.pkg ? path.dirname(process.execPath) : __dirname;
	const filePath = path.join(basePath, 'config.yaml');

	try {
		const yamlData = fs.readFileSync(filePath, 'utf8');
		const yamlConfig = yaml.load(yamlData);
		return ConfigSchema.parse(yamlConfig); // Validate config with Zod

	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error(
				`Config validation error: ${error.issues
					.map((issue) => `${issue.path.join('.')} - ${issue.message}`)
					.join(', ')}`
			);
		} else {
			console.error(`Error reading ${filePath}: ${error.message}`);
		}
		process.exit(1); // Exit with a failure code
	}
}

module.exports = { loadYAMLConfig };

