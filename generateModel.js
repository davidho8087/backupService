import fs from 'fs-extra';
import yaml from 'js-yaml';

const configFile = './config.yaml';
const prismaSchemaFile = './prisma/schema.prisma';

try {
    // Load the configuration from the YAML file
    const config = yaml.load(fs.readFileSync(configFile, 'utf8'));
    let newModelStr = `model ${config.DB_SCHEMA.name} {\n`;

    config.DB_SCHEMA.fields.forEach(field => {
        let fieldDef = `  ${field.name} ${field.type}`;
        if (field.isId) {
            fieldDef += ' @id @default(autoincrement())';
        }
        if (field.default !== undefined) {
            fieldDef += ` @default(${field.default})`;
        }
        newModelStr += `${fieldDef}\n`;
    });

    newModelStr += '}\n';

    // Read and update the schema file
    let schemaContent = fs.existsSync(prismaSchemaFile) ? fs.readFileSync(prismaSchemaFile, 'utf8') : '';
    const modelRegex = new RegExp(`model ${config.DB_SCHEMA.name} \\{[\\s\\S]*?\\n\\}`, 'g');
    schemaContent = schemaContent.replace(modelRegex, '');  // Remove the existing model
    schemaContent += `\n${newModelStr}`;  // Append the new model definition

    fs.writeFileSync(prismaSchemaFile, schemaContent);
    console.log(`Model ${config.DB_SCHEMA.name} updated or created successfully in schema.prisma.`);

} catch (error) {
    console.error(`Failed to update model: ${error}`);
    process.exit(1);  // Exit the process with an error code
}
