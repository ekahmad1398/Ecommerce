import category from "../../models/category.js";
export const GetCategories = async (req, res, next) => {
    try {
        const parentFilter = { parentCategory: null };
        const totalCategories = await category.countDocuments(parentFilter);
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
        const totalPages = Math.ceil(totalCategories / limit);
        const page = Math.min(Math.max(Number(req.query.page) || 1, 1), Math.max(totalPages, 1));
        const skip = (page - 1) * limit;
        const parentCategories = await category
            .find(parentFilter)
            .select("name image _id")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const children = await category
            .find({
            parentCategory: { $in: parentCategories.map(({ _id }) => _id) },
        })
            .select("name image parentCategory")
            .sort({ createdAt: -1 })
            .lean();
        const childrenByParent = new Map();
        for (const child of children) {
            const parentId = String(child.parentCategory);
            const siblings = childrenByParent.get(parentId) ?? [];
            siblings.push(child);
            childrenByParent.set(parentId, siblings);
        }
        const formatedData = parentCategories.map((parent) => ({
            ...parent,
            children: childrenByParent.get(String(parent._id)) ?? [],
        }));
        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages,
            totalCategories,
            categories: formatedData,
        });
    }
    catch (error) {
        next(error);
    }
};
