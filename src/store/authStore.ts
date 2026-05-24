"use client";

import { create } from "zustand";
import { AppUser, PlatformRole, RestaurantRole, RestaurantAccess } from "@/types/auth";

interface AuthState {
  users: AppUser[];
  currentUserId: string | null;
  activeRestaurantId: string | null;

  setUsers: (users: AppUser[]) => void;
  login: (userId: string) => void;
  setSessionUser: (user: AppUser) => void;
  logout: () => void;
  setActiveRestaurant: (restaurantId: string) => void;

  addUser: (user: Omit<AppUser, "id" | "createdAt">) => void;
  updateUser: (id: string, data: Partial<Omit<AppUser, "id" | "createdAt">>) => void;
  removeUser: (id: string) => void;

  assignRestaurantRole: (userId: string, restaurantId: string, role: RestaurantRole) => void;
  removeRestaurantAccess: (userId: string, restaurantId: string) => void;

  getCurrentUser: () => AppUser | null;
  getUserRestaurantRole: (userId: string, restaurantId: string) => RestaurantRole | null;
  getAccessibleRestaurantIds: (userId: string) => string[];
  canAccessRestaurant: (userId: string, restaurantId: string) => boolean;
}

function generateId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  users: [],
  currentUserId: null,
  activeRestaurantId: null,

  setUsers: (users) => set({ users }),

  login: (userId) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user) return;
    set({ currentUserId: userId });
  },

  setSessionUser: (user) =>
    set((s) => {
      const exists = s.users.some((u) => u.id === user.id);
      return {
        users: exists ? s.users.map((u) => (u.id === user.id ? user : u)) : [...s.users, user],
        currentUserId: user.id,
      };
    }),

  logout: () => set({ currentUserId: null, activeRestaurantId: null }),

  setActiveRestaurant: (restaurantId) => set({ activeRestaurantId: restaurantId }),

  addUser: (userData) =>
    set((s) => ({
      users: [
        ...s.users,
        {
          ...userData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  updateUser: (id, data) =>
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
    })),

  removeUser: (id) =>
    set((s) => ({
      users: s.users.filter((u) => u.id !== id),
      ...(s.currentUserId === id
        ? { currentUserId: null, activeRestaurantId: null }
        : {}),
    })),

  assignRestaurantRole: (userId, restaurantId, role) =>
    set((s) => ({
      users: s.users.map((u) => {
        if (u.id !== userId) return u;
        const existing = u.restaurantAccess.findIndex(
          (a) => a.restaurantId === restaurantId
        );
        const access = [...u.restaurantAccess];
        if (existing >= 0) {
          access[existing] = { restaurantId, role };
        } else {
          access.push({ restaurantId, role });
        }
        return { ...u, restaurantAccess: access };
      }),
    })),

  removeRestaurantAccess: (userId, restaurantId) =>
    set((s) => ({
      users: s.users.map((u) => {
        if (u.id !== userId) return u;
        return {
          ...u,
          restaurantAccess: u.restaurantAccess.filter(
            (a) => a.restaurantId !== restaurantId
          ),
        };
      }),
    })),

  getCurrentUser: () => {
    const { users, currentUserId } = get();
    return users.find((u) => u.id === currentUserId) ?? null;
  },

  getUserRestaurantRole: (userId, restaurantId) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user) return null;
    if (user.platformRole === "admin") return "owner";
    const access = user.restaurantAccess.find(
      (a) => a.restaurantId === restaurantId
    );
    return access?.role ?? null;
  },

  getAccessibleRestaurantIds: (userId) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user) return [];
    if (user.platformRole === "admin") return ["__all__"];
    return user.restaurantAccess.map((a) => a.restaurantId);
  },

  canAccessRestaurant: (userId, restaurantId) => {
    const user = get().users.find((u) => u.id === userId);
    if (!user) return false;
    if (user.platformRole === "admin") return true;
    return user.restaurantAccess.some((a) => a.restaurantId === restaurantId);
  },
}));
