const roleMiddleware = (...allowedroles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                message: "authentication required",
            });
        }
        if (!allowedroles.includes(user.role)) {
            return res.status(403).json({
                message: "you dont have permission to access this resource",
            });
        }
        next();
    };
};
export default roleMiddleware;
