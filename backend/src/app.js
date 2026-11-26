const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const CATEGORIES = ['Fiction', 'Science', 'History', 'Technology', 'Biography', 'Other'];

const bookSchema = new mongoose.Schema({
  bookCode: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  isbn: { type: String, required: true, unique: true },
  category: { type: String, required: true, enum: CATEGORIES },
  totalCopies: { type: Number, required: true, min: 1, max: 20 },
  availableCopies: { type: Number, required: true, min: 0 }
}, { timestamps: true });

const loanSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  memberName: { type: String, required: true, trim: true },
  memberId: { type: String, required: true, trim: true },
  issueDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date, default: null },
  fine: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

const Book = mongoose.model('Book', bookSchema);
const Loan = mongoose.model('Loan', loanSchema);

function respond(res, status, success, message, data = null) {
  return res.status(status).json({ success, message, data });
}

function todayAtMidnight(value = new Date()) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function validateBookInput(body, editing = false) {
  if (!editing) {
    if (!body.title || !body.author || !body.isbn || !body.category || body.totalCopies === undefined) {
      return 'Title, author, ISBN, category and total copies are required';
    }
    if (!CATEGORIES.includes(body.category)) return 'Invalid category';
    if (!/^\d{10}(\d{3})?$/.test(String(body.isbn))) return 'ISBN must contain exactly 10 or 13 digits';
  }
  if (body.totalCopies !== undefined) {
    if (!Number.isInteger(Number(body.totalCopies)) || Number(body.totalCopies) < 1 || Number(body.totalCopies) > 20) {
      return 'Total copies must be between 1 and 20';
    }
  }
  return null;
}

async function nextBookCode(category) {
  const prefix = `LB-${category.slice(0, 3).toUpperCase()}-`;
  const books = await Book.find({ bookCode: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    .select('bookCode').lean();
  let max = 0;
  for (const b of books) {
    const match = b.bookCode.match(/-(\d{3,})$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

app.get('/api/health', (req, res) => respond(res, 200, true, 'API is running'));

app.get('/api/books', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = 5;
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.available === 'true') filter.availableCopies = { $gt: 0 };
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: regex }, { author: regex }];
    }
    const [books, total] = await Promise.all([
      Book.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Book.countDocuments(filter)
    ]);
    respond(res, 200, true, 'Books retrieved', { books, page, totalPages: Math.ceil(total / limit), total });
  } catch (error) {
    respond(res, 500, false, 'Failed to retrieve books', { error: error.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return respond(res, 404, false, 'Book not found');
    const book = await Book.findById(req.params.id).lean();
    if (!book) return respond(res, 404, false, 'Book not found');
    const loans = await Loan.find({ book: book._id }).sort({ issueDate: -1 }).lean();
    const today = todayAtMidnight();
    const history = loans.map(loan => ({
      ...loan,
      isOverdue: !loan.returnDate && today > todayAtMidnight(loan.dueDate)
    }));
    respond(res, 200, true, 'Book details retrieved', { book, loans: history });
  } catch (error) {
    respond(res, 500, false, 'Failed to retrieve book', { error: error.message });
  }
});

app.post('/api/books', async (req, res) => {
  try {
    const error = validateBookInput(req.body);
    if (error) return respond(res, 400, false, error);
    const existing = await Book.findOne({ isbn: String(req.body.isbn).trim() });
    if (existing) return respond(res, 409, false, 'A book with this ISBN already exists');
    const totalCopies = Number(req.body.totalCopies);
    const book = await Book.create({
      bookCode: await nextBookCode(req.body.category),
      title: req.body.title.trim(), author: req.body.author.trim(),
      isbn: String(req.body.isbn).trim(), category: req.body.category,
      totalCopies, availableCopies: totalCopies
    });
    respond(res, 201, true, 'Book added successfully', book);
  } catch (error) {
    if (error.code === 11000) return respond(res, 409, false, 'Duplicate ISBN or book code');
    if (error.name === 'ValidationError') return respond(res, 400, false, error.message);
    respond(res, 500, false, 'Failed to add book', { error: error.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return respond(res, 404, false, 'Book not found');
    const error = validateBookInput(req.body, true);
    if (error) return respond(res, 400, false, error);
    const book = await Book.findById(req.params.id);
    if (!book) return respond(res, 404, false, 'Book not found');
    if (req.body.title !== undefined) book.title = req.body.title.trim();
    if (req.body.author !== undefined) book.author = req.body.author.trim();
    if (req.body.totalCopies !== undefined) {
      const issuedCount = await Loan.countDocuments({ book: book._id, returnDate: null });
      const totalCopies = Number(req.body.totalCopies);
      if (totalCopies < issuedCount) return respond(res, 400, false, `Total copies cannot be below ${issuedCount} currently issued copies`);
      book.totalCopies = totalCopies;
      book.availableCopies = Math.max(0, Math.min(totalCopies, totalCopies - issuedCount));
    }
    await book.save();
    respond(res, 200, true, 'Book updated successfully', book);
  } catch (error) {
    respond(res, 400, false, 'Failed to update book', { error: error.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return respond(res, 404, false, 'Book not found');
    const activeLoans = await Loan.countDocuments({ book: req.params.id, returnDate: null });
    if (activeLoans > 0) return respond(res, 400, false, 'Cannot delete a book with unreturned copies');
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return respond(res, 404, false, 'Book not found');
    await Loan.deleteMany({ book: req.params.id });
    respond(res, 200, true, 'Book deleted successfully', book);
  } catch (error) {
    respond(res, 500, false, 'Failed to delete book', { error: error.message });
  }
});

app.post('/api/books/:id/issue', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return respond(res, 404, false, 'Book not found');
    const { memberName, memberId, issueDate } = req.body;
    if (!memberName || !memberId || !issueDate) return respond(res, 400, false, 'Member name, member ID and issue date are required');
    const issue = todayAtMidnight(issueDate);
    if (Number.isNaNaN(issue.getTime())) return respond(res, 400, false, 'Invalid issue date');
    if (issue > todayAtMidnight()) return respond(res, 400, false, 'Issue date cannot be in the future');
    const book = await Book.findById(req.params.id);
    if (!book) return respond(res, 404, false, 'Book not found');
    if (book.availableCopies <= 0) return respond(res, 409, false, 'No copies are available');
    const duplicate = await Loan.findOne({ book: book._id, memberId: String(memberId).trim(), returnDate: null });
    if (duplicate) return respond(res, 409, false, 'This member already holds an unreturned copy of this book');
    const due = new Date(issue); due.setDate(due.getDate() + 14);
    const loan = await Loan.create({ book: book._id, memberName: memberName.trim(), memberId: String(memberId).trim(), issueDate: issue, dueDate: due });
    book.availableCopies -= 1;
    await book.save();
    respond(res, 201, true, 'Book issued successfully', loan);
  } catch (error) {
    respond(res, 500, false, 'Failed to issue book', { error: error.message });
  }
});

app.post('/api/loans/:loanId/return', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.loanId)) return respond(res, 404, false, 'Loan not found');
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return respond(res, 404, false, 'Loan not found');
    if (loan.returnDate) return respond(res, 409, false, 'This loan has already been returned');
    const returnDate = todayAtMidnight();
    const dueDate = todayAtMidnight(loan.dueDate);
    const lateDays = returnDate > dueDate ? Math.floor((returnDate - dueDate) / 86400000) : 0;
    loan.returnDate = returnDate;
    loan.fine = lateDays * 5;
    await loan.save();
    const book = await Book.findById(loan.book);
    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      await book.save();
    }
    respond(res, 200, true, 'Book returned successfully', loan);
  } catch (error) {
    respond(res, 500, false, 'Failed to return book', { error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [titles, copies, issued, overdueLoans, fineResult] = await Promise.all([
      Book.countDocuments(),
      Book.aggregate([{ $group: { _id: null, total: { $sum: '$totalCopies' } } }]),
      Loan.countDocuments({ returnDate: null }),
      Loan.countDocuments({ returnDate: null, dueDate: { $lt: todayAtMidnight() } }),
      Loan.aggregate([{ $match: { returnDate: { $ne: null } } }, { $group: { _id: null, total: { $sum: '$fine' } } }])
    ]);
    respond(res, 200, true, 'Statistics retrieved', {
      totalTitles: titles,
      totalCopies: copies[0]?.total || 0,
      copiesIssued: issued,
      overdueLoans: overdueLoans,
      totalFineCollected: fineResult[0]?.total || 0
    });
  } catch (error) {
    respond(res, 500, false, 'Failed to retrieve stats', { error: error.message });
  }
});

module.exports = app;
