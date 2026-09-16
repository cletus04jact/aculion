"use client";

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Map,
  TrendingUp,
  Users,
  CloudRain,
  FileText,
  Bookmark,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
} from "lucide-react";

interface SidebarProps {
  billboardId?: string;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  billboardId,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
    },
    {
      name: "Location Intelligence",
      icon: Map,
      path: "#location-intelligence",
    },
    {
      name: "Traffic Intelligence",
      icon: TrendingUp,
      path: "#traffic",
    },
    {
      name: "Audience Intelligence",
      icon: Users,
      path: "#audience-intelligence",
    },
    {
      name: "Environmental Analysis",
      icon: CloudRain,
      path: "#environmental",
    },
    {
      name: "Reports",
      icon: FileText,
      path: "#reports",
    },
    {
      name: "Saved Locations",
      icon: Bookmark,
      path: "#saved",
    },
    {
      name: "Settings",
      icon: Settings,
      path: "#settings",
    },
  ];

  const handleLogout = () => {
    // Redirection back to landing
    navigate("/billboards");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card/80 backdrop-blur-xl border-r border-border text-foreground">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 h-16 border-b border-border">
        <Link to="/billboards" className="flex items-center gap-2 font-bold text-lg text-primary">
          <Layers className="h-6 w-6 text-primary animate-pulse" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent font-extrabold tracking-wider"
              >
                Aculion LI
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        
        {/* Toggle button on desktop */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex p-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Close button on mobile */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "" : "group-hover:text-primary transition-colors"}`} />
              
              {!isCollapsed && (
                <span className="text-sm whitespace-nowrap">{item.name}</span>
              )}

              {/* Tooltip on collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs rounded border border-border shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout bottom action */}
      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200 group relative"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-4 px-2 py-1 bg-destructive text-destructive-foreground text-xs rounded border border-destructive/20 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
              Logout
            </div>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar Layout */}
      <aside
        className={`hidden md:block h-screen sticky top-0 transition-all duration-300 z-30 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 z-50 md:hidden h-full"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
