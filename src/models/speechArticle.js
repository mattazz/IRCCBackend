import mongoose from 'mongoose';
const {Schema, model} = mongoose;

const speechArticleSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    summary: {
        type: String,
        required: true
    }
})

const SpeechArticle = model('tg_speech_articles', speechArticleSchema);

export default SpeechArticle;