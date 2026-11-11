import z from "zod";

const attributeItemSchema = z.object({
  key: z.string().trim().min(1, "An attribute key cannot be empty.").toLowerCase(),
  value: z.union([
    z.string().trim().min(1),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().trim().min(1)).min(1).max(100),
  ]),
});

const parseJsonInput = (value: unknown) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const categoryAttributeDefinitionSchema = z.object({
  key: z.string().trim().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).toLowerCase(),
  label: z.string().trim().min(1).max(100),
  type: z.enum(["text", "number", "boolean", "select"]),
  unit: z.string().trim().max(24).optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  required: z.boolean().default(false),
  filterable: z.boolean().default(true),
}).superRefine((definition, ctx) => {
  if (definition.type === "select" && !definition.options?.length) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Select attributes must define at least one option.",
    });
  }
  if (definition.type !== "select" && definition.options?.length) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Only select attributes can define options.",
    });
  }
});

const uniqueAttributeKeys = (
  definitions: Array<{ key: string }> | null | undefined,
  ctx: z.RefinementCtx,
) => {
  if (!definitions) return;
  const keys = new Set<string>();
  for (const [index, definition] of definitions.entries()) {
    if (keys.has(definition.key)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "key"],
        message: "Attribute keys must be unique within a category.",
      });
    }
    keys.add(definition.key);
  }
};

const productAttributesSchema = z.preprocess(
  parseJsonInput,
  z.array(attributeItemSchema).superRefine(uniqueAttributeKeys).nullable().optional(),
);

const categoryAttributesSchema = z.preprocess(
  parseJsonInput,
  z.array(categoryAttributeDefinitionSchema)
    .max(100)
    .superRefine(uniqueAttributeKeys),
);

const imagearray = z.object({
  cloudinaryId: z.string().trim().min(1, "A Cloudinary image ID is required."),
  publicId: z.string().url("A valid image URL is required."),
  _id: z.string().trim().min(1, "At least an _id is needed for image."),
});

export const productBodySchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters"),
  brand: z.string().trim().min(1, "Product brand is required.").default("GEN"),
  description: z
    .string()
    .trim()
    .min(10, "description must be at least 2 characters"),
  categoryID: z.string().trim(),
  colors: z
    .string()
    .transform((str, ctx) => {
      try {
        return JSON.parse(str);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid colors JSON array" });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.string()).min(1, "Select at least one color option")),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  price: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().positive("price must be a postive number.")),
  stock: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative("stock cannot be a negative value.")),
  discount: z
    .number()
    .transform((val) => Math.round(val * 100) / 100)
    .pipe(
      z
        .number()
        .nonnegative("discount must be a postive number.")
        .lt(100, "discount must be lower than 100."),
    )
    .nullable()
    .optional(),
  attributes: productAttributesSchema,
});

export const updateproductBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "name must be at least 2 characters")
    .optional(),
  brand: z.string().trim().min(1, "brand name is required.").optional(),
  description: z
    .string()
    .trim()
    .min(10, "description must be at least 2 characters")
    .optional(),
  categoryID: z
    .string()
    .trim()
    .min(1, "categoryID name is required.")
    .optional(),
  colors: z
    .string()
    .transform((str, ctx) => {
      try {
        return JSON.parse(str);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid colors JSON array" });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.string()).nullable().optional()),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  vendorId: z.email().trim().toLowerCase().optional(),
  price: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().positive("price must be a postive number."))
    .optional(),
  stock: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative("stock cannot be a negative value."))
    .optional(),
  discount: z
    .number()
    .transform((val) => Math.round(val * 100) / 100)
    .pipe(
      z
        .number()
        .nonnegative("discount must be a postive number.")
        .lt(100, "discount must be lower than 100."),
    )
    .nullable()
    .optional(),
  attributes: productAttributesSchema,
  images: z
    .string()
    .optional()
    .transform((str, ctx) => {
      if (!str || str.trim() === "") return null;
      try {
        return JSON.parse(str);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: "invalid json array structure",
        });
        return z.NEVER;
      }
    })
    .pipe(z.array(imagearray).nullable().optional()),
});

const brandsListSchema = z.preprocess(
  parseJsonInput,
  z.array(z.string().trim().min(1).max(100)).max(100),
);

export const updateCategoryBodySchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters").optional(),
  parentCategory: z.string().trim().optional(),
  attributes: categoryAttributesSchema.optional(),
  brands: brandsListSchema.optional(),
  removeImage: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => value === true || value === "true")
    .optional(),
});

export const createCategoryBodySchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters."),
  parentCategory: z.string().trim().optional(),
  attributes: categoryAttributesSchema.optional(),
  brands: brandsListSchema.optional(),
});
