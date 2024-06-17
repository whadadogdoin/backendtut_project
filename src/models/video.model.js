import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema({
    videoFile:{
        type: String,
        required: true
    },
    thumbnail:{
        type: String,
        required: true
    },
    title:{
        type: String,
        required: true
    },
    description:{
        type: String,
    },
    duration:{
        type: Number,
        required: true
    },
    views:{
        type: Number,
        default: 0,
        required: true
    },
    isPublished:{
        type: Boolean,
        default: true,
        required: true
    },
    owner:{
        type: Schema.type.ObjectId,
        ref: "User",
        required: true
    }
},
{
    timestamps: true,
})

videoSchema.mongoose(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema)