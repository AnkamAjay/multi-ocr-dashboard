"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMe } from "../services/api";
import { useRouter, usePathname } from "next/navigation";

interface User {
    id: number;
    username: string;
    email: string;
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, userData: User) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
            setToken(storedToken);
            fetchUser();
        } else {
            setLoading(false);
            if (!isPublicRoute(pathname)) {
                router.push("/login");
            }
        }
    }, []);

    const isPublicRoute = (path: string) => {
    	return (
        	path === "/login" ||
        	path === "/signup" ||
        	path.endsWith("/login") ||
        	path.endsWith("/signup")
    	);
};		

    const fetchUser = async () => {
        try {
            const userData = await getMe();
            setUser(userData);
        } catch (error) {
            console.error("Failed to fetch user info", error);
            logout();
        } finally {
            setLoading(false);
            if (isPublicRoute(pathname)) {
                router.push("/");
            }
        }
    };

    const login = (newToken: string, userData: User) => {
        localStorage.setItem("token", newToken);
        setToken(newToken);
        setUser(userData);
        router.push("/");
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        router.push("/login");
    };

    // Route guard effect
    useEffect(() => {
        if (!loading) {
            if (!user && !isPublicRoute(pathname)) {
                router.push("/login");
            }
        }
    }, [user, loading, pathname]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
