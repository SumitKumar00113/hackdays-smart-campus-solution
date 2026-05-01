const Notice = require("../models/Notice");

const createNotice = async (req, res) => {
  const notice = await Notice.create(req.body);
  res.status(201).json(notice);
};

const updateNotice = async (req, res) => {
  const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(notice);
};

const deleteNotice = async (req, res) => {
  await Notice.findByIdAndDelete(req.params.id);
  res.json({ message: "Notice deleted" });
};

const getNotices = async (req, res) => {
  const notices = await Notice.find().populate("author", "name");
  res.json(notices);
};

module.exports = { createNotice, updateNotice, deleteNotice, getNotices };
