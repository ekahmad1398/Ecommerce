import z from "zod";

const attributeItemSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "if you add an attribute, the key cannot be empty."),
  value: z
    .string()
    .trim()
    .min(1, "if you add a vlue, the key cannot be empty."),
});

const imagearray = z.object({
  cloudinaryId: z.string().url("must be a valid image link."),
  publicId: z
    .string()
    .trim()
    .min(1, "At least a publicId should be given for image."),
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
  color: z.string().trim().nullable().optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  vendorId: z.email().trim().toLowerCase(),
  price: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().positive("price must be a postive number.")),
  stock: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().nonnegative("stock cannot be a negative value.")),
  discount: z
    .string()
    .transform((val) => (val ? parseFloat(val) : null))
    .pipe(z.number().nonnegative("discount must be a postive number."))
    .nullable()
    .optional(),
  attributes: z
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
    .pipe(z.array(attributeItemSchema).nullable().optional()),
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
  color: z.string().trim().nullable().optional(),
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
    .string()
    .transform((val) => (val ? parseFloat(val) : null))
    .pipe(z.number().nonnegative("discount must be a postive number."))
    .nullable()
    .optional(),
  attributes: z
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
    .pipe(z.array(attributeItemSchema).nullable().optional()),
  images: z
    .string()
    .optional()
    .transform((str, ctx) => {
      if (!str || str.trim() === "") return [];
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
