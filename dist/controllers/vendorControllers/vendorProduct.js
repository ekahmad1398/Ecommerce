import Product, { generateSKU } from "../../models/Product.js";
import categorySchema from "../../models/category.js";
import mongoose from "mongoose";
import { uploadToCloudinary, deleteFromCloudinary, } from "../../middleware/upload.js";
import { optimizefunction } from "../../utils/optimizer.js";
import { productBodySchema, updateproductBodySchema, } from "../../utils/zodValidators.js";
const MAX_PRODUCT_IMAGES = 5;
const resolveImageOrder = (rawOrder, expectedTokens) => {
    if (rawOrder === undefined)
        return expectedTokens;
    if (typeof rawOrder !== "string")
        return null;
    let parsedOrder;
    try {
        parsedOrder = JSON.parse(rawOrder);
    }
    catch {
        return null;
    }
    if (!Array.isArray(parsedOrder) ||
        !parsedOrder.every((token) => typeof token === "string")) {
        return null;
    }
    const tokens = new Set(parsedOrder);
    if (parsedOrder.length !== expectedTokens.length ||
        tokens.size !== parsedOrder.length ||
        expectedTokens.some((token) => !tokens.has(token))) {
        return null;
    }
    return parsedOrder;
};
const refreshProductCount = async (categoryId) => {
    let currentCategoryId = categoryId;
    let productCount = await Product.countDocuments({
        categoryID: categoryId,
        status: "active",
        isDeleted: { $ne: true },
    });
    while (currentCategoryId) {
        const updatedCategory = await categorySchema
            .findByIdAndUpdate(currentCategoryId, { $set: { ProductCount: productCount } }, { new: true })
            .select("parentCategory");
        const parentId = updatedCategory?.parentCategory ?? null;
        if (!parentId)
            return;
        const [childProductCount] = await categorySchema.aggregate([
            { $match: { parentCategory: parentId } },
            {
                $group: {
                    _id: null,
                    ProductCount: { $sum: { $ifNull: ["$ProductCount", 0] } },
                },
            },
        ]);
        const parentDirectProductCount = await Product.countDocuments({
            categoryID: parentId,
            status: "active",
            isDeleted: { $ne: true },
        });
        currentCategoryId = parentId.toString();
        productCount =
            parentDirectProductCount + (childProductCount?.ProductCount ?? 0);
    }
};
const normalizeProductStatus = (status) => (status === "archived" ? "archieved" : status);
const isLevelThreeCategory = async (categoryId) => {
    if (!mongoose.isValidObjectId(categoryId))
        return false;
    const selectedCategory = await categorySchema
        .findById(categoryId)
        .select("parentCategory")
        .lean();
    if (!selectedCategory?.parentCategory)
        return false;
    const parentCategory = await categorySchema
        .findById(selectedCategory.parentCategory)
        .select("parentCategory")
        .lean();
    if (!parentCategory?.parentCategory)
        return false;
    const grandparentCategory = await categorySchema
        .findById(parentCategory.parentCategory)
        .select("parentCategory")
        .lean();
    if (!grandparentCategory || grandparentCategory.parentCategory)
        return false;
    const hasLevelFourChildren = await categorySchema.exists({
        parentCategory: selectedCategory._id,
    });
    return !hasLevelFourChildren;
};
const validateLevelThreeCategory = async (categoryId, res) => {
    if (await isLevelThreeCategory(categoryId))
        return true;
    res.status(400).json({
        success: false,
        message: "Select a level-3 category. Other category levels are not allowed.",
    });
    return false;
};
export const getVendorProductCategoryAttributes = async (req, res, next) => {
    try {
        const id = typeof req.params.id === "string" ? req.params.id : "";
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "A valid category ID is required.",
            });
        }
        const selectedCategory = await categorySchema
            .findById(id)
            .select("attributes")
            .lean();
        if (!selectedCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found.",
            });
        }
        if (!(await isLevelThreeCategory(id))) {
            return res.status(400).json({
                success: false,
                message: "Select a level-3 category. Other category levels are not allowed.",
            });
        }
        return res.status(200).json({
            success: true,
            categoryId: id,
            attributes: selectedCategory.attributes ?? [],
        });
    }
    catch (error) {
        return next(error);
    }
};
const RESERVED_BRAND_VALUES = new Set(["General", "GEN"]);
const validateBrandForCategory = async (categoryId, brand, isCustomBrand, res) => {
    const selectedCategory = await categorySchema
        .findById(categoryId)
        .select("brands")
        .lean();
    if (!selectedCategory) {
        res.status(404).json({ success: false, message: "Category not found." });
        return false;
    }
    const allowedBrands = new Set([
        ...(selectedCategory.brands ?? []),
        ...RESERVED_BRAND_VALUES,
    ]);
    if (isCustomBrand || allowedBrands.has(brand))
        return true;
    res.status(400).json({
        success: false,
        message: `Brand '${brand}' is not allowed for this category.`,
    });
    return false;
};
const validateProductAttributes = async (categoryId, attributes, res) => {
    const selectedCategory = await categorySchema
        .findById(categoryId)
        .select("attributes")
        .lean();
    if (!selectedCategory) {
        res.status(404).json({ success: false, message: "Category not found." });
        return null;
    }
    const definitions = (selectedCategory.attributes ?? []);
    const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const submittedKeys = new Set();
    for (const attribute of attributes) {
        const definition = definitionsByKey.get(attribute.key);
        if (!definition || submittedKeys.has(attribute.key)) {
            res.status(400).json({
                success: false,
                message: `Attribute '${attribute.key}' is not allowed or was submitted more than once.`,
            });
            return null;
        }
        const validType = (definition.type === "text" && typeof attribute.value === "string") ||
            (definition.type === "number" && typeof attribute.value === "number") ||
            (definition.type === "boolean" && typeof attribute.value === "boolean") ||
            (definition.type === "select" &&
                ((typeof attribute.value === "string" &&
                    definition.options?.includes(attribute.value)) ||
                    (Array.isArray(attribute.value) &&
                        attribute.value.length > 0 &&
                        attribute.value.every((option) => definition.options?.includes(option)))));
        if (!validType) {
            res.status(400).json({
                success: false,
                message: `Attribute '${attribute.key}' has an invalid value for its category definition.`,
            });
            return null;
        }
        submittedKeys.add(attribute.key);
    }
    const missingRequired = definitions.find((definition) => definition.required && !submittedKeys.has(definition.key));
    if (missingRequired) {
        res.status(400).json({
            success: false,
            message: `Attribute '${missingRequired.key}' is required for this category.`,
        });
        return null;
    }
    return attributes;
};
export const CreateVendorProduct = async (req, res, next) => {
    try {
        const vendorID = req.user.vendorID;
        const validatedData = productBodySchema.parse(req.body);
        const duplicateProduct = await Product.findOne({
            name: validatedData.name,
            brand: validatedData.brand,
        });
        if (duplicateProduct) {
            return res.status(400).json({
                success: false,
                message: "This product has already been create, you cannot upload duplicates.",
            });
        }
        const incomingImages = Array.isArray(req.files) ? req.files : [];
        const uploadTokens = incomingImages.map((_, index) => `new:${index}`);
        const imageOrder = resolveImageOrder(req.body.imageOrder, uploadTokens);
        if (!imageOrder) {
            return res.status(400).json({
                success: false,
                message: "The image order is invalid.",
            });
        }
        if (!(await validateLevelThreeCategory(validatedData.categoryID, res)))
            return;
        const brandIsCustom = req.body.brandIsCustom === "true";
        if (!(await validateBrandForCategory(validatedData.categoryID, validatedData.brand, brandIsCustom, res)))
            return;
        const productAttributes = await validateProductAttributes(validatedData.categoryID, validatedData.attributes ?? [], res);
        if (!productAttributes)
            return;
        let imagesData = [];
        if (incomingImages.length > 0) {
            const orderedIncomingImages = imageOrder.map((token) => {
                const index = Number(token.slice("new:".length));
                const file = incomingImages[index];
                if (!file)
                    throw new Error("Image order refers to an unavailable upload.");
                return file;
            });
            const result = (await Promise.all(orderedIncomingImages.map((file) => uploadToCloudinary(file.buffer))));
            for (const data of result) {
                const optimizedImage = optimizefunction(data.secure_url);
                imagesData.push({
                    cloudinaryId: data.public_id,
                    publicId: optimizedImage,
                });
            }
        }
        else {
            return res
                .status(400)
                .json({ success: false, message: "at least one image is required." });
        }
        const createdSKU = generateSKU({
            name: validatedData.name,
            brand: validatedData.brand,
            color: validatedData.colors[0],
        });
        const addedProduct = await Product.create({
            name: validatedData.name,
            description: validatedData.description,
            brand: validatedData.brand,
            categoryID: validatedData.categoryID,
            stock: validatedData.stock,
            price: validatedData.price,
            discount: validatedData.discount ?? 0,
            colors: validatedData.colors,
            sku: createdSKU,
            vendorId: vendorID,
            images: imagesData,
            attributes: productAttributes,
            status: normalizeProductStatus(validatedData.status),
        });
        await refreshProductCount(String(addedProduct.categoryID));
        res.status(201).json({
            success: true,
            newProduct: addedProduct,
        });
    }
    catch (error) {
        next(error);
    }
};
export const UpdateVendorProduct = async (req, res, next) => {
    try {
        const vendorId = req.user.vendorID;
        const validatedData = updateproductBodySchema.parse(req.body);
        const productID = req.params.id;
        if (!vendorId || !productID) {
            return res.status(403).json({
                success: false,
                message: "access unauthorized. verified vendor required",
            });
        }
        const newImages = Array.isArray(req.files) ? req.files : [];
        const product = await Product.findOne({ _id: productID, vendorId });
        if (!product) {
            return res
                .status(404)
                .json({ success: false, message: "product not found." });
        }
        const categoryId = validatedData.categoryID ?? String(product.categoryID);
        if (!(await validateLevelThreeCategory(categoryId, res)))
            return;
        if (validatedData.brand !== undefined) {
            const brandIsCustom = req.body.brandIsCustom === "true";
            if (!(await validateBrandForCategory(categoryId, validatedData.brand, brandIsCustom, res)))
                return;
        }
        const submittedAttributes = validatedData.attributes === undefined
            ? product.attributes.map(({ key, value }) => ({ key, value }))
            : validatedData.attributes ?? [];
        const productAttributes = await validateProductAttributes(categoryId, submittedAttributes, res);
        if (!productAttributes)
            return;
        const clientImages = validatedData.images ?? [];
        if (clientImages.length + newImages.length > MAX_PRODUCT_IMAGES) {
            return res.status(400).json({
                success: false,
                message: `A product can have a maximum of ${MAX_PRODUCT_IMAGES} images.`,
            });
        }
        const expectedImageTokens = [
            ...clientImages.map((image) => `existing:${image._id}`),
            ...newImages.map((_, index) => `new:${index}`),
        ];
        const imageOrder = resolveImageOrder(req.body.imageOrder, expectedImageTokens);
        if (!imageOrder) {
            return res.status(400).json({
                success: false,
                message: "The image order is invalid.",
            });
        }
        const imagesToDelete = product.images.filter((mongoImages) => !clientImages?.some((clientImg) => String(clientImg._id) === String(mongoImages._id)));
        let newUploadedImages = [];
        if (newImages.length > 0) {
            const result = (await Promise.all(newImages.map((file) => uploadToCloudinary(file.buffer))));
            for (const data of result) {
                newUploadedImages.push({
                    cloudinaryId: data.public_id,
                    publicId: optimizefunction(data.secure_url),
                });
            }
        }
        const imagesByToken = new Map();
        clientImages.forEach((image) => {
            imagesByToken.set(`existing:${image._id}`, image);
        });
        newUploadedImages.forEach((image, index) => {
            imagesByToken.set(`new:${index}`, image);
        });
        const finalTotalImages = imageOrder.map((token) => {
            const image = imagesByToken.get(token);
            if (!image)
                throw new Error("Image order refers to an unavailable image.");
            return image;
        });
        const updatedProduct = await Product.findOneAndUpdate({ _id: productID, vendorId }, {
            name: validatedData.name,
            description: validatedData.description,
            price: validatedData.price,
            stock: validatedData.stock,
            categoryID: validatedData.categoryID,
            brand: validatedData.brand,
            colors: validatedData.colors,
            discount: validatedData.discount,
            status: normalizeProductStatus(validatedData.status),
            images: finalTotalImages,
            attributes: productAttributes,
        }, { returnDocument: "after", runValidators: true });
        if (!updatedProduct) {
            return res
                .status(404)
                .json({ success: false, message: "the product is not available." });
        }
        if (imagesToDelete.length > 0) {
            await Promise.all(imagesToDelete.map((image) => deleteFromCloudinary(image.cloudinaryId)));
        }
        const previousCategoryId = String(product.categoryID);
        const updatedCategoryId = String(updatedProduct.categoryID);
        if (product.status !== updatedProduct.status ||
            previousCategoryId !== updatedCategoryId) {
            for (const categoryId of new Set([
                previousCategoryId,
                updatedCategoryId,
            ])) {
                await refreshProductCount(categoryId);
            }
        }
        res.status(201).json({
            success: true,
            newProduct: updatedProduct,
        });
    }
    catch (error) {
        next(error);
    }
};
export const deleteVendorProduct = async (req, res, next) => {
    try {
        const vendorId = req.user.vendorID;
        const productID = req.params.id;
        if (!vendorId || !productID) {
            return res.status(403).json({
                success: false,
                message: "access unauthorized. verified vendor required",
            });
        }
        const product = await Product.findOne({ _id: productID, vendorId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "product not found.",
            });
        }
        await Promise.all(product.images.map((image) => deleteFromCloudinary(image.cloudinaryId)));
        await Product.findByIdAndDelete(product.id);
        await refreshProductCount(String(product.categoryID));
        res.status(200).json({
            success: true,
            message: "product is permenantly deleted.",
        });
    }
    catch (error) {
        next(error);
    }
};
export const readProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.vendorID;
        if (!vendorId || !mongoose.isValidObjectId(id)) {
            return res.status(404).json({
                success: false,
                message: "product not found.",
            });
        }
        const product = await Product.findOne({
            _id: id,
            vendorId,
            isDeleted: { $ne: true },
        }).lean();
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "product not found.",
            });
        }
        return res.status(200).json({ success: true, product });
    }
    catch (error) {
        next(error);
    }
};
