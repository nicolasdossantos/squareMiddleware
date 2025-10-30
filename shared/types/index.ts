/**
 * Shared TypeScript types for Fluent Front AI
 * Used across both frontend (dashboard) and backend (api)
 */

// ============================================================================
// Auth & User Types
// ============================================================================

export interface AuthUser {
  id: string
  tenantId: string
  email: string
  businessName: string
  role: 'admin' | 'staff' | 'viewer'
  createdAt: string
  updatedAt: string
}

export interface AuthToken {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupData {
  businessName: string
  industry: string
  timezone: string
  email: string
  password: string
  confirmPassword: string
  squareAccountConnected: boolean
}

// ============================================================================
// Voice & Agent Types
// ============================================================================

export interface VoicePreference {
  voiceId: string
  voiceName: string
  accent: string
  gender: 'male' | 'female' | 'neutral'
  language: string
  temperature: number // 0-1
  speakingSpeed: number // 0.5-2
  backgroundAmbience?: string
}

export interface AgentConfig {
  id: string
  tenantId: string
  voicePreference: VoicePreference
  language: string[]
  status: 'pending_qa' | 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Phone Number Types
// ============================================================================

export interface PhoneNumber {
  id: string
  tenantId: string
  phoneNumber: string
  status: 'active' | 'releasing' | 'ported'
  type: 'retell' | 'existing'
  areaCode?: string
  assignedAgent?: string
  forwardingNumber?: string
  portingStatus?: PortingStatus
  createdAt: string
  updatedAt: string
}

export interface PortingStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  estimatedCompletion?: string
  documents: Document[]
  carrierContact?: string
}

export interface Document {
  id: string
  type: string
  status: 'pending' | 'submitted' | 'approved'
  uploadedAt: string
}

// ============================================================================
// Booking & Call Types
// ============================================================================

export interface Booking {
  id: string
  tenantId: string
  customerId: string
  callId?: string
  service: string
  startTime: string
  duration: number // in minutes
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CallLog {
  id: string
  tenantId: string
  customerId?: string
  phoneNumber: string
  direction: 'inbound' | 'outbound'
  duration: number // in seconds
  status: 'completed' | 'missed' | 'failed'
  sentiment?: 'positive' | 'neutral' | 'negative'
  transcript?: string
  recordingUrl?: string
  agentState?: string
  createdAt: string
  updatedAt: string
}

export interface CallDetail extends CallLog {
  callerName?: string
  callSummary?: string
  bookingCreated?: boolean
  escalationFlags?: string[]
  highlights?: string[]
}

// ============================================================================
// Customer Types
// ============================================================================

export interface Customer {
  id: string
  tenantId: string
  phoneNumber: string
  name?: string
  email?: string
  preferredLanguage?: string
  totalCalls: number
  totalBookings: number
  lastCallDate?: string
  createdAt: string
  updatedAt: string
}

export interface CustomerMemory {
  id: string
  customerId: string
  tenantId: string
  context: ContextEntry[]
  openIssues: Issue[]
  changeLog: ChangeLogEntry[]
}

export interface ContextEntry {
  id: string
  key: string
  value: string | boolean | object
  confidence?: number
  source: string
  createdAt: string
  updatedAt: string
}

export interface Issue {
  id: string
  customerId: string
  status: 'open' | 'resolved'
  description: string
  detectedAt: string
  resolvedAt?: string
}

export interface ChangeLogEntry {
  id: string
  userId: string
  field: string
  oldValue?: string
  newValue?: string
  changedAt: string
}

// ============================================================================
// Support & Analytics Types
// ============================================================================

export interface SupportTicket {
  id: string
  tenantId: string
  customerId?: string
  callId?: string
  subject: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  assignee?: string
  aiGenerated: boolean
  diagnosticSummary?: string
  recommendation?: string
  createdAt: string
  updatedAt: string
}

export interface CallAnalytics {
  tenantId: string
  periodStart: string
  periodEnd: string
  totalCalls: number
  totalDuration: number // in minutes
  averageDuration: number
  conversionRate: number // booking completion %
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  peakCallTimes: PeakHour[]
  languageBreakdown: Record<string, number>
  outcomeDistribution: Record<string, number>
}

export interface PeakHour {
  hour: number
  callCount: number
  averageDuration: number
}

export interface UsageMetrics {
  tenantId: string
  planId: string
  minutesAllowed: number
  minutesUsed: number
  minutesRemaining: number
  ovageRate: number
  resetDate: string
  billingCycle: 'monthly' | 'annual'
}

// ============================================================================
// Billing Types
// ============================================================================

export interface Plan {
  id: string
  name: string
  price: number
  currency: string
  minutesPerMonth: number
  features: string[]
  tier: 'free' | 'starter' | 'pro' | 'enterprise'
}

export interface Subscription {
  id: string
  tenantId: string
  planId: string
  status: 'active' | 'cancelled' | 'past_due'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelledAt?: string
  paymentMethod?: string
}

export interface Invoice {
  id: string
  tenantId: string
  subscriptionId: string
  amount: number
  currency: string
  status: 'paid' | 'unpaid' | 'refunded'
  issuedAt: string
  dueAt: string
  paidAt?: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
  requestId?: string
}
