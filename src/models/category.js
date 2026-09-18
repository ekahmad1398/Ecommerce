import mongoose from "mongoose"

const data = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    parentCategory:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"category",
        default:null
    },
    attributes:[
        {
            type:String,
            trim:true
        }
    ]
},
{timestamps:true})

export default mongoose.model("category", data)