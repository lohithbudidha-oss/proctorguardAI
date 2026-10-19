'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  HelpCircle, 
  Users, 
  FileText, 
  BarChart3, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Send, 
  Filter, 
  MessageSquare, 
  LifeBuoy, 
  Trash2, 
  ChevronRight,
  ExternalLink,
  Check,
  X,
  UserCheck
} from 'lucide-react';
import api from '@/lib/api';

interface SupportTicketItem {
  _id: string;
  name: string;
  email: string;
  category: 'TECHNICAL' | 'EXAM_ACCESS' | 'ORGANIZATION' | 'OTHER';
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  adminNotes?: string;
  resolvedAt?: string;
  resolvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminHelpDeskPage() {
  const [tickets, setTickets] = useState<SupportTicketItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_admin_tickets');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pg_cached_admin_tickets');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch (e) {}
    }
    return true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeTicket, setActiveTicket] = useState<SupportTicketItem | null>(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/admin/helpdesk');
      if (res.data?.tickets) {
        const list = res.data.tickets;
        setTickets(list);
        try {
          sessionStorage.setItem('pg_cached_admin_tickets', JSON.stringify(list.slice(0, 50)));
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Failed to fetch help desk tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    setUpdatingStatusId(ticketId);
    try {
      const res = await api.patch(`/admin/helpdesk/${ticketId}`, { status: newStatus });
      if (res.data?.ticket) {
        setTickets(prev => prev.map(t => t._id === ticketId ? { ...t, ...res.data.ticket } : t));
        if (activeTicket && activeTicket._id === ticketId) {
          setActiveTicket(prev => prev ? { ...prev, ...res.data.ticket } : null);
        }
        showToast(`Ticket status updated to ${newStatus}`);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update ticket status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSaveNotes = async (ticketId: string) => {
    setSavingNotes(true);
    try {
      const res = await api.patch(`/admin/helpdesk/${ticketId}`, { adminNotes: adminNotesDraft });
      if (res.data?.ticket) {
        setTickets(prev => prev.map(t => t._id === ticketId ? { ...t, adminNotes: adminNotesDraft } : t));
        if (activeTicket && activeTicket._id === ticketId) {
          setActiveTicket(prev => prev ? { ...prev, adminNotes: adminNotesDraft } : null);
        }
        showToast('Internal resolution notes saved successfully');
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this support ticket? This action cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/admin/helpdesk/${ticketId}`);
      setTickets(prev => prev.filter(t => t._id !== ticketId));
      if (activeTicket?._id === ticketId) {
        setActiveTicket(null);
      }
      showToast('Support ticket deleted successfully');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete support ticket');
    }
  };

  const openTicketDetail = (ticket: SupportTicketItem) => {
    setActiveTicket(ticket);
    setAdminNotesDraft(ticket.adminNotes || '');
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);

    return tickets.filter(t => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

      // 2. Category Filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

      // 3. Search Query
      if (tokens.length > 0) {
        const searchableBlob = [
          t.name,
          t.email,
          t.category,
          t.status,
          t.message,
          t.adminNotes || '',
          t._id
        ].join(' ').toLowerCase();

        return tokens.every(token => searchableBlob.includes(token));
      }

      return true;
    });
  }, [tickets, searchQuery, statusFilter, categoryFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'OPEN').length;
    const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length;
    const resolved = tickets.filter(t => t.status === 'RESOLVED').length;
    const closed = tickets.filter(t => t.status === 'CLOSED').length;
    return { total, open, inProgress, resolved, closed };
  }, [tickets]);

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'TECHNICAL': return 'Webcam / Audio Issue';
      case 'EXAM_ACCESS': return 'Exam Access & Registration';
      case 'ORGANIZATION': return 'Organization / Admin';
      case 'OTHER': return 'General Support';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'TECHNICAL': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'EXAM_ACCESS': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ORGANIZATION': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'OTHER': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
            OPEN
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 mr-1 text-blue-600" />
            IN PROGRESS
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-700" />
            RESOLVED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
            CLOSED
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white">URGENT</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">LOW</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Navigation & Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
          <div className="min-w-0 flex-1 pr-0 xl:pr-4">
            <div className="flex items-center space-x-3 mb-2">
              <Link 
                href="/admin/monitoring" 
                className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-100 transition shadow-2xs shrink-0" 
                title="Back to Admin Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
                <LifeBuoy className="w-7 h-7 mr-2.5 text-blue-600 shrink-0" /> Help Desk & Support Inquiries
              </h1>
            </div>
            <p className="text-slate-500 text-sm">
              Review, manage, and respond to incoming technical support tickets sent from the candidate Contact Support Desk.
            </p>
          </div>

          {/* Top Navigation Pill Buttons (Strictly aligned on single row) */}
          <div className="flex items-center gap-2 shrink-0 flex-nowrap overflow-x-auto max-w-full pb-1 xl:pb-0">
            <Link 
              href="/admin/monitoring" 
              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-50 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Admin Dashboard
            </Link>
            <Link 
              href="/admin/exams" 
              className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 font-semibold rounded-lg hover:bg-slate-50 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Exam Management
            </Link>
            <Link 
              href="/admin/results" 
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-semibold rounded-lg hover:bg-blue-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Results
            </Link>
            <Link 
              href="/admin/violations" 
              className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 font-semibold rounded-lg hover:bg-rose-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Violations
            </Link>
            <Link 
              href="/admin/candidates" 
              className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 font-semibold rounded-lg hover:bg-amber-100 transition shadow-2xs text-xs flex items-center h-8.5 shrink-0 whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Candidates
            </Link>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs animate-fadeIn">
            <div className="flex items-center text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-700 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Inquiries</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{stats.total}</div>
            <p className="text-[11px] text-slate-400 mt-1">Submitted from Contact Support Desk</p>
          </div>

          <div className="bg-white border border-amber-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Open Tickets</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-amber-900 mt-2">{stats.open}</div>
            <p className="text-[11px] text-amber-600/80 mt-1">Pending review & response</p>
          </div>

          <div className="bg-white border border-blue-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">In Progress</span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-blue-900 mt-2">{stats.inProgress}</div>
            <p className="text-[11px] text-blue-500 mt-1">Being actively investigated</p>
          </div>

          <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Resolved</span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-900 mt-2">{stats.resolved}</div>
            <p className="text-[11px] text-emerald-700 mt-1">Successfully resolved</p>
          </div>
        </div>

        {/* Search, Filter, and Action Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, ticket ID, or issue..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              <option value="TECHNICAL">Webcam / Audio Issues</option>
              <option value="EXAM_ACCESS">Exam Access & Registration</option>
              <option value="ORGANIZATION">Organization Inquiry</option>
              <option value="OTHER">General Support</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* Status Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'}`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('OPEN')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'OPEN' ? 'bg-white text-amber-700 shadow-2xs' : 'hover:text-slate-900'}`}
              >
                Open ({stats.open})
              </button>
              <button
                onClick={() => setStatusFilter('IN_PROGRESS')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'IN_PROGRESS' ? 'bg-white text-blue-700 shadow-2xs' : 'hover:text-slate-900'}`}
              >
                In Progress ({stats.inProgress})
              </button>
              <button
                onClick={() => setStatusFilter('RESOLVED')}
                className={`px-3 py-1 rounded-lg transition ${statusFilter === 'RESOLVED' ? 'bg-white text-emerald-700 shadow-2xs' : 'hover:text-slate-900'}`}
              >
                Resolved ({stats.resolved})
              </button>
            </div>

            <button
              onClick={fetchTickets}
              disabled={loading}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh Tickets"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tickets Grid / List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
            <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading Support Tickets...</p>
            <p className="text-xs text-slate-400 mt-1">Fetching candidate inquiries from database.</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">No Support Tickets Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'No tickets match the selected filters or search terms. Try clearing search filters.'
                : 'All clear! No support inquiries have been submitted from the Contact Support Desk yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map(ticket => (
              <div 
                key={ticket._id}
                className={`bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-xs p-6 ${
                  ticket.status === 'OPEN' 
                    ? 'border-amber-200/90 ring-1 ring-amber-100' 
                    : ticket.status === 'IN_PROGRESS'
                    ? 'border-blue-200/90'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200">
                      {ticket.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className="text-sm font-extrabold text-slate-900">{ticket.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryColor(ticket.category)}`}>
                          {getCategoryLabel(ticket.category)}
                        </span>
                        {getPriorityBadge(ticket.priority)}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                        <span className="font-medium text-slate-600">{ticket.email}</span>
                        <span>•</span>
                        <span>Received: {formatDate(ticket.createdAt)}</span>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-slate-400">ID: {ticket._id.substring(ticket._id.length - 6)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="flex items-center space-x-2.5 shrink-0 self-start lg:self-center">
                    {getStatusBadge(ticket.status)}

                    <select
                      value={ticket.status}
                      disabled={updatingStatusId === ticket._id}
                      onChange={e => handleUpdateStatus(ticket._id, e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer focus:outline-none"
                    >
                      <option value="OPEN">Mark OPEN</option>
                      <option value="IN_PROGRESS">Mark IN PROGRESS</option>
                      <option value="RESOLVED">Mark RESOLVED</option>
                      <option value="CLOSED">Mark CLOSED</option>
                    </select>

                    <a
                      href={`mailto:${ticket.email}?subject=Regarding Your Support Ticket [${ticket._id.substring(ticket._id.length - 6)}] - ProctorGuardAI Support&body=Hello ${encodeURIComponent(ticket.name)},%0D%0A%0D%0AWe are writing back regarding your support inquiry on ${encodeURIComponent(getCategoryLabel(ticket.category))}:%0D%0A"${encodeURIComponent(ticket.message)}"%0D%0A%0D%0A`}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center transition shadow-2xs cursor-pointer"
                      title="Direct email reply via candidate mail client"
                    >
                      <Mail className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      Email Candidate
                    </a>

                    <button
                      onClick={() => openTicketDetail(ticket)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center transition cursor-pointer"
                    >
                      Notes / Details
                    </button>

                    <button
                      onClick={() => handleDeleteTicket(ticket._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete Ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Candidate Message Body */}
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Inquiry Description</p>
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {ticket.message}
                  </div>
                </div>

                {/* Admin Resolution Notes Snippet if present */}
                {ticket.adminNotes && (
                  <div className="mt-3 bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl flex items-start text-xs text-amber-900">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Admin Resolution Notes: </span>
                      <span>{ticket.adminNotes}</span>
                      {ticket.resolvedAt && (
                        <span className="block text-[11px] text-amber-700/80 mt-0.5">
                          Resolved on: {formatDate(ticket.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ticket Detail & Admin Notes Modal */}
        {activeTicket && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 animate-scaleIn">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <LifeBuoy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Support Ticket Details</h3>
                    <p className="text-xs text-slate-400">ID: {activeTicket._id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTicket(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold">Candidate:</span>
                    <span className="text-slate-800 font-extrabold text-sm">{activeTicket.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Email:</span>
                    <span className="text-slate-800 font-medium">{activeTicket.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Category:</span>
                    <span className="font-semibold text-slate-800">{getCategoryLabel(activeTicket.category)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Submitted Date:</span>
                    <span className="text-slate-800">{formatDate(activeTicket.createdAt)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Candidate Inquiry:</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {activeTicket.message}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Internal Resolution Notes / Actions Taken:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Document action taken, troubleshooting steps sent to candidate, or why ticket was resolved..."
                    value={adminNotesDraft}
                    onChange={e => setAdminNotesDraft(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeTicket._id, 'RESOLVED')}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                    Mark Resolved
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeTicket._id, 'IN_PROGRESS')}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    In Progress
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveTicket(null)}
                    className="px-3.5 py-2 text-slate-600 hover:text-slate-800 text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={() => handleSaveNotes(activeTicket._id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
