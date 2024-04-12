import fs from 'fs';
import yaml from 'js-yaml';
import {z} from "zod";
import logger from "./lib/logger.js";

// Validates time in "HH:mm" format.
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const PathConfigSchema = z.object({
    isEnabled: z.boolean(),
    folderToZipPath: z.string(),
    destinationPath: z.string(),
    dailyAt: z.string().optional().nullable().refine(val => {
        // Validate that the time is in HH:mm format if val is not null
        return val == null || timePattern.test(val);
    }, {
        message: "dailyAt must be in HH:mm format"
    }),
    everyXHours: z.number().optional().nullable().refine(val => {
        // Validate that the number is between 1 and 23 if val is not null
        return val == null || (val >= 1 && val <= 23);
    }, {
        message: "everyXHours must be between 1 and 23"
    }),
    everyXMinutes: z.number().optional().nullable().refine(val => {
        // Validate that the number is between 1 and 59 if val is not null
        return val == null || (val >= 1 && val <= 59);
    }, {
        message: "everyXMinutes must be between 1 and 59"
    }),
});

const ConfigSchema = z.object({
    CLIENT_BRAND: z.string(),
    STORE_CODE: z.string(),
    HOST: z.string(),
    PORT: z.number(),
    NODE_ENV: z.string(),
    BATCH_SIZE: z.number(),
    PATH_CONFIG: PathConfigSchema,
});

export function loadYAMLConfig() {
    const filePath = './config.yaml';
    try {
        const yamlData = fs.readFileSync(filePath, 'utf8');
        const yamlConfig = yaml.load(yamlData);
        return ConfigSchema.parse(yamlConfig);  // Validate config with Zod
    } catch (error) {
        if (error instanceof z.ZodError) {
            error.issues.forEach(issue => {
                console.error(`Validation error - ${issue.path.join('.')} : ${issue.message}`);
            });
            // Optionally return a default config or handle the error according to your needs
            process.exit(1); // or handle more gracefully depending on your application's needs
        } else {
            logger.error(`Error reading ${filePath}:`, error);
            throw error;  // Rethrow the error if it's not a ZodError
        }
    }
}

