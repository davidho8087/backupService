import fs from 'fs';
import yaml from 'js-yaml';
import {z} from "zod";


// Define schema using Zod
const PathConfigSchema = z.object({
    isEnabled: z.boolean(),
    folderToZip: z.string(),
    destinationPath: z.string(),
    scheduledTime: z.string(),
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
        // Load YAML file
        const yamlConfig = yaml.load(fs.readFileSync('config.yaml', 'utf8'));

        return ConfigSchema.parse(yamlConfig);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        throw error;
    }
}
