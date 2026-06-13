import { getIdToken } from "firebase/auth";
import { auth } from "./firebase";

const API_BASE = "/api/v1";

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  const token = await getIdToken(user);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API 오류 (${response.status}): ${text}`);
  }
  return response.json() as Promise<T>;
}

// Auth
export async function syncUser() {
  return request("/auth/sync", { method: "POST" });
}

// User profile
export async function getMyProfile() {
  return request<{ uid: string; profile?: UserProfile | null }>("/users/me");
}

export async function updateProfile(profile: UserProfile) {
  return request("/users/me/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

// Feed
export async function getFeed(limit = 20) {
  return request<FeedResponse>(`/feed?limit=${limit}`);
}

export async function getFeedItem(itemId: string) {
  return request<WelfareItem>(`/feed/${itemId}`);
}

// Summarize (on-demand, card click)
export async function summarizeCard(params: SummarizeParams) {
  return request<{ summary: string }>("/summarize", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Notifications
export async function getNotifications() {
  return request<{ notifications: Notification[]; unread_count: number }>(
    "/notifications"
  );
}

export async function markNotificationRead(notifId: string) {
  return request(`/notifications/${notifId}/read`, { method: "PATCH" });
}

// Voice NLU
export async function interpretVoice(transcript: string, step: string) {
  return request<NLUResult>("/voice/interpret", {
    method: "POST",
    body: JSON.stringify({ transcript, step }),
  });
}

// Types
export interface UserProfile {
  age: number;
  regionCode: string;
  regionName: string;
  occupation: string;
  interests: string[];
}

export interface WelfareItem {
  id: string;
  title: string;
  category: "복지" | "행사";
  rawText: string;
  sourceName: string;
  sourceUrl: string;
  applyDeadline?: string | null;
  targetInterests: string[];
  regions: string[];
  isActive: boolean;
  _score?: number;
  // legacy compat
  raw_text?: string;
  source_name?: string;
  source_url?: string;
  is_region_expanded?: boolean;
  search_region?: string;
}

export interface FeedResponse {
  cards: WelfareItem[];
  total_count: number;
  welfare_count?: number;
  event_count?: number;
  message: string;
  profile_complete: boolean;
}

export interface SummarizeParams {
  title: string;
  raw_text: string;
  age: number;
  region_name: string;
  occupation: string;
  interests: string[];
}

export interface Notification {
  id: string;
  userId: string;
  type: "deadline_reminder" | "new_welfare" | "profile_prompt";
  welfareItemId?: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: { seconds: number };
}

export interface NLUResult {
  matched_value: string | null;
  matched_label: string | null;
  exact_age: number | null;
  confidence: number;
  reasoning: string;
}
