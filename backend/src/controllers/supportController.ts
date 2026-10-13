import { Request, Response } from 'express';
import SupportTicket, { TicketCategory, TicketPriority, TicketStatus } from '../models/SupportTicket';

// POST /api/support - Public submission from Contact Support Desk
export const createSupportTicket = async (req: Request, res: Response) => {
  try {
    const { name, email, category, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and issue description are required.' 
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanMessage = String(message).trim();

    // Default priority mapping based on issue severity
    let initialPriority: TicketPriority = 'MEDIUM';
    if (category === 'TECHNICAL' || category === 'EXAM_ACCESS') {
      initialPriority = 'HIGH';
    }

    const ticket = await SupportTicket.create({
      name: cleanName,
      email: cleanEmail,
      category: (category as TicketCategory) || 'TECHNICAL',
      message: cleanMessage,
      status: 'OPEN',
      priority: initialPriority,
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || '',
      userAgent: (req.headers['user-agent'] as string) || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Your support inquiry has been recorded successfully. An administrator will review it shortly.',
      ticket: {
        id: ticket._id,
        name: ticket.name,
        email: ticket.email,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    });
  } catch (error: any) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record support ticket. Please try again later.'
    });
  }
};

// GET /api/admin/support - Admin Help Desk tickets list with statistics
export const getSupportTickets = async (req: Request, res: Response) => {
  try {
    const { status, category, search } = req.query;

    const query: any = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { message: searchRegex },
        { adminNotes: searchRegex }
      ];
    }

    const [tickets, totalCount, openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
      SupportTicket.find(query)
        .populate('resolvedBy', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
      SupportTicket.countDocuments({}),
      SupportTicket.countDocuments({ status: 'OPEN' }),
      SupportTicket.countDocuments({ status: 'IN_PROGRESS' }),
      SupportTicket.countDocuments({ status: 'RESOLVED' }),
      SupportTicket.countDocuments({ status: 'CLOSED' })
    ]);

    return res.json({
      success: true,
      tickets,
      stats: {
        total: totalCount,
        open: openCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        closed: closedCount
      }
    });
  } catch (error: any) {
    console.error('Error fetching support tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve help desk tickets.'
    });
  }
};

// PATCH /api/admin/support/:id - Admin update status, notes, or priority
export const updateSupportTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, adminNotes } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    if (status) {
      ticket.status = status as TicketStatus;
      if (status === 'RESOLVED' || status === 'CLOSED') {
        ticket.resolvedAt = new Date();
        if ((req as any).user?._id) {
          ticket.resolvedBy = (req as any).user._id;
        }
      }
    }

    if (priority) {
      ticket.priority = priority as TicketPriority;
    }

    if (adminNotes !== undefined) {
      ticket.adminNotes = adminNotes;
    }

    await ticket.save();

    return res.json({
      success: true,
      message: 'Support ticket updated successfully.',
      ticket
    });
  } catch (error: any) {
    console.error('Error updating support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update support ticket.'
    });
  }
};

// DELETE /api/admin/support/:id - Admin delete/archive ticket
export const deleteSupportTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findByIdAndDelete(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Support ticket removed successfully.'
    });
  } catch (error: any) {
    console.error('Error deleting support ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete support ticket.'
    });
  }
};
