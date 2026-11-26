import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';

const API = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const categories = ['Fiction','Science','History','Technology','Biography','Other'];

async function api(path, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  let body;
  try { body = await response.json(); } catch { body = { success: false, message: 'Invalid server response', data: null }; }
  if (!response.ok) throw new Error(body.message || 'Request failed');
  return body;
}

function today() { return new Date().toISOString().slice(0, 10); }

function Layout({ children }) {
  const navigate = useNavigate();
  return <div className="app"><header><button className="brand" onClick={() => navigate('/')}>📚 Library Manager</button><button className="primary" onClick={() => navigate('/add')}>+ Add Book</button></header><main>{children}</main></div>;
}

function App() {
  return <BrowserRouter><Routes><Route path="/*" element={<Layout><Dashboard/></Layout>}/><Route path="/add" element={<Layout><BookForm/></Layout>}/><Route path="/books/:id" element={<Layout><BookDetails/></Layout>}/><Route path="/books/:id/edit" element={<Layout><BookForm edit/></Layout>}/></Routes></BrowserRouter>;
}

function Dashboard() {
  const [stats,setStats] = useState({});
  const [books,setBooks] = useState([]);
  const [category,setCategory] = useState('');
  const [available,setAvailable] = useState(false);
  const [search,setSearch] = useState('');
  const [page,setPage] = useState(1);
  const [pages,setPages] = useState(1);
  const [error,setError] = useState('');
  const navigate = useNavigate();
  async function load(){ try { const [s,b] = await Promise.all([api('/stats'),api(`/books?page=${page}&category=${encodeURIComponent(category)}&available=${available}&search=${encodeURIComponent(search)}`)]); setStats(s.data); setBooks(b.data.books); setPages(b.data.totalPages || 1); setError(''); } catch(e){ setError(e.message); } }
  useEffect(()=>{ load(); },[page,category,available]);
  useEffect(()=>{ const t=setTimeout(()=>{ setPage(1); load(); },350); return ()=>clearTimeout(t); },[search]);
  return <><section className="stats">{[
    ['Titles',stats.totalTitles ?? 0,'📖'],['Total copies',stats.totalCopies ?? 0,'📚'],['Copies issued',stats.copiesIssued ?? 0,'🔖'],['Overdue loans',stats.overdueLoans ?? 0,'⚠'],['Fine collected','₹'+(stats.totalFineCollected ?? 0),'₹']
  ].map(x=><div className="stat" key={x[0]}><span>{x[2]}</span><div><b>{x[1]}</b><small>{x[0]}</small></div></div>)}</section>
  <section className="panel"><div className="toolbar"><input aria-label="Search" placeholder="Search title or author..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={category} onChange={e=>{setPage(1);setCategory(e.target.value)}}><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select><label className="check"><input type="checkbox" checked={available} onChange={e=>{setPage(1);setAvailable(e.target.checked)}}/> Available only</label></div>
  {error&&<div className="alert">{error}</div>}<div className="tablewrap"><table><thead><tr><th>Code</th><th>Title</th><th>Author</th><th>Category</th><th>Copies</th><th>Actions</th></tr></thead><tbody>{books.map(b=><tr key={b._id}><td><b>{b.bookCode}</b></td><td>{b.title}</td><td>{b.author}</td><td><span className="tag">{b.category}</span></td><td className={b.availableCopies===0?'zero':''}>{b.availableCopies}/{b.totalCopies}</td><td><button onClick={()=>navigate(`/books/${b._id}`)}>View</button></td></tr>)}</tbody></table>{books.length===0&&<p className="empty">No books found</p>}</div><div className="pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next</button></div></section></>;
}

function BookForm({edit=false}) {
  const {id}=useParams(); const navigate=useNavigate();
  const [form,setForm]=useState({title:'',author:'',isbn:'',category:'Fiction',totalCopies:1});
  const [error,setError]=useState('');
  useEffect(()=>{ if(edit) api(`/books/${id}`).then(r=>{const b=r.data.book;setForm({title:b.title,author:b.author,isbn:b.isbn,category:b.category,totalCopies:b.totalCopies})}).catch(e=>setError(e.message)); },[edit,id]);
  function change(e){setForm({...form,[e.target.name]:e.target.value});}
  async function submit(e){e.preventDefault();setError(''); if(!edit&&!/^\d{10}(\d{3})?$/.test(form.isbn))return setError('ISBN must contain exactly 10 or 13 digits'); const copies=Number(form.totalCopies);if(!Number.isInteger(copies)||copies<1||copies>20)return setError('Total copies must be between 1 and 20');try{if(edit)await api(`/books/${id}`,{method:'PUT',body:JSON.stringify({title:form.title,author:form.author,totalCopies:copies})});else await api('/books',{method:'POST',body:JSON.stringify({...form,totalCopies:copies})});navigate('/');}catch(e){setError(e.message)}}
  return <section className="panel formpanel"><h1>{edit?'Edit Book':'Add New Book'}</h1>{error&&<div className="alert">{error}</div>}<form onSubmit={submit} className="formgrid"><label>Title<input name="title" value={form.title} onChange={change} required/></label><label>Author<input name="author" value={form.author} onChange={change} required/></label><label>ISBN<input name="isbn" value={form.isbn} onChange={change} disabled={edit} required pattern="\\d{10}|\\d{13}"/></label><label>Category<select name="category" value={form.category} onChange={change} disabled={edit}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Total Copies<input name="totalCopies" type="number" min="1" max="20" value={form.totalCopies} onChange={change} required/></label><div className="formactions"><button type="button" onClick={()=>navigate(-1)}>Cancel</button><button className="primary" type="submit">{edit?'Save Changes':'Add Book'}</button></div></form></section>;
}

function Modal({title,children,onClose}){return <div className="modalback"><div className="modal"><div className="modalhead"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>}

function BookDetails(){
 const {id}=useParams(); const navigate=useNavigate();
 const [book,setBook]=useState(null);const [loans,setLoans]=useState([]);const [issueOpen,setIssueOpen]=useState(false);const [issue,setIssue]=useState({memberName:'',memberId:'',issueDate:today()});const [error,setError]=useState('');
 async function load(){try{const r=await api(`/books/${id}`);setBook(r.data.book);setLoans(r.data.loans);}catch(e){setError(e.message)}} useEffect(()=>{load()},[id]);
 async function issueBook(e){e.preventDefault();setError('');try{await api(`/books/${id}/issue`,{method:'POST',body:JSON.stringify(issue)});setIssueOpen(false);setIssue({memberName:'',memberId:'',issueDate:today()});await load();}catch(e){setError(e.message)}}
 async function returnLoan(loanId){if(!window.confirm('Confirm return of this loan?'))return;try{await api(`/loans/${loanId}/return`,{method:'POST'});await load();}catch(e){setError(e.message)}}
 async function remove(){if(!window.confirm('Are you sure you want to delete this book?'))return;try{await api(`/books/${id}`,{method:'DELETE'});navigate('/');}catch(e){setError(e.message)}}
 if(!book)return <p>Loading...</p>; const activeLoans=loans.filter(l=>!l.returnDate).length;
 return <><section className="panel detail"><div><span className="tag">{book.bookCode}</span><h1>{book.title}</h1><p>by {book.author} · {book.category}</p><p><b>ISBN:</b> {book.isbn}</p></div><div className="detailactions"><div className={book.availableCopies===0?'copies zero':'copies'}>{book.availableCopies}/{book.totalCopies} available</div><button disabled={book.availableCopies===0} onClick={()=>setIssueOpen(true)}>Issue</button><button onClick={()=>navigate(`/books/${id}/edit`)}>Edit</button><button className="danger" disabled={activeLoans>0} onClick={remove}>Delete</button></div></section>{error&&<div className="alert">{error}</div>}<section className="panel"><h2>Loan History</h2><div className="tablewrap"><table><thead><tr><th>Member</th><th>Member ID</th><th>Issue Date</th><th>Due Date</th><th>Return Date</th><th>Fine</th><th>Status</th><th></th></tr></thead><tbody>{loans.map(l=>{const overdue=l.isOverdue;return<tr key={l._id}><td>{l.memberName}</td><td>{l.memberId}</td><td>{new Date(l.issueDate).toLocaleDateString()}</td><td>{new Date(l.dueDate).toLocaleDateString()}</td><td>{l.returnDate?new Date(l.returnDate).toLocaleDateString():'-'}</td><td>₹{l.fine||0}</td><td><span className={'badge '+(l.returnDate?'returned':overdue?'overdue':'issued')}>{l.returnDate?'Returned':overdue?'Overdue':'Issued'}</span></td><td>{!l.returnDate&&<button onClick={()=>returnLoan(l._id)}>Return</button>}</td></tr>})}</tbody></table>{loans.length===0&&<p className="empty">No loan history</p>}</div></section>{issueOpen&&<Modal title="Issue Book" onClose={()=>setIssueOpen(false)}><form onSubmit={issueBook} className="formgrid single">{error&&<div className="alert">{error}</div>}<label>Member Name<input value={issue.memberName} onChange={e=>setIssue({...issue,memberName:e.target.value})} required/></label><label>Member ID<input value={issue.memberId} onChange={e=>setIssue({...issue,memberId:e.target.value})} required/></label><label>Issue Date<input type="date" max={today()} value={issue.issueDate} onChange={e=>setIssue({...issue,issueDate:e.target.value})} required/></label><div className="formactions"><button type="button" onClick={()=>setIssueOpen(false)}>Cancel</button><button className="primary">Issue Book</button></div></form></Modal>}</>;
}

export default App;
