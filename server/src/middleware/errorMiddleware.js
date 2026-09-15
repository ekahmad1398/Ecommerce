import { Request, Response, NextFunction } from "express";

const errorhandler = (err, req, res, next) => {
    console.log(err)
    res.status(500)
    res.json({
        message: err.message || "internal server error",
    })
}