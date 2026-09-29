import { z } from "zod";
import { ToolDefinition, ToolParameterProperty } from "@nova/shared";

export function zodToToolDefinition(
  name: string,
  description: string,
  schema: z.ZodType<any>,
): ToolDefinition {
  const properties: Record<string, ToolParameterProperty> = {};
  const required: string[] = [];

  // Extract object shape if ZodObject
  let currentSchema: any = schema;
  while (
    currentSchema._def.typeName === "ZodEffects" ||
    currentSchema._def.typeName === "ZodOptional"
  ) {
    currentSchema = currentSchema._def.schema || currentSchema._def.innerType;
  }

  if (currentSchema._def.typeName === "ZodObject") {
    const shape = currentSchema.shape;
    for (const [key, value] of Object.entries(shape)) {
      const fieldDef = extractField(value as z.ZodTypeAny);
      properties[key] = fieldDef.property;
      if (fieldDef.isRequired) {
        required.push(key);
      }
    }
  }

  return {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    },
  };
}

function extractField(field: z.ZodTypeAny): {
  property: ToolParameterProperty;
  isRequired: boolean;
} {
  let isRequired = true;
  let current: any = field;
  let description: string | undefined = current.description;

  while (
    current._def.typeName === "ZodOptional" ||
    current._def.typeName === "ZodNullable" ||
    current._def.typeName === "ZodDefault"
  ) {
    if (
      current._def.typeName === "ZodOptional" ||
      current._def.typeName === "ZodNullable"
    ) {
      isRequired = false;
    }
    if (!description && current.description) {
      description = current.description;
    }
    current = current._def.innerType || current._def.schema;
  }

  if (!description && current.description) {
    description = current.description;
  }

  const typeName = current._def.typeName;
  let type = "string";
  let enumValues: string[] | undefined;

  switch (typeName) {
    case "ZodString":
      type = "string";
      break;
    case "ZodNumber":
      type = "number";
      break;
    case "ZodBoolean":
      type = "boolean";
      break;
    case "ZodArray":
      type = "array";
      break;
    case "ZodEnum":
      type = "string";
      enumValues = current._def.values;
      break;
    case "ZodObject":
      type = "object";
      break;
    default:
      type = "string";
  }

  return {
    property: {
      type,
      description,
      enum: enumValues,
    },
    isRequired,
  };
}
