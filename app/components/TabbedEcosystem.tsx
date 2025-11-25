"use client";

import { useState } from "react";
import Link from "next/link";
import { ecosystemItems } from "@/lib/constants";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

const tabs = [
  { id: "core", label: "Core Platform", icon: "Cpu" },
  { id: "panels", label: "Panels", icon: "LayoutDashboard" },
  { id: "modules", label: "Ethics Modules", icon: "Shield" },
];

export default function TabbedEcosystem() {
  const [activeTab, setActiveTab] = useState("core");

  const getActiveItems = () => {
    switch (activeTab) {
      case "core":
        return ecosystemItems.core;
      case "panels":
        return ecosystemItems.panels;
      case "modules":
        return ecosystemItems.modules;
      default:
        return ecosystemItems.core;
    }
  };

  return (
    <div>
      <FadeIn>
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-semibold text-eza-text mb-6 tracking-tight">
            EZA Ekosistemi
          </h2>
          <p className="text-2xl text-eza-text-secondary font-light max-w-2xl mx-auto">
            Teknolojinin etik kullanımı için kapsamlı platform ve araçlar
          </p>
        </div>
      </FadeIn>

      {/* Tabs */}
      <div className="flex justify-center mb-16">
        <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm border border-gray-200/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-8 py-3 rounded-full font-medium transition-all duration-300 flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-eza-text text-white shadow-sm"
                  : "text-eza-text-secondary hover:text-eza-text hover:bg-eza-gray/50"
              }`}
            >
              <Icon name={tab.icon} size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getActiveItems().map((item, index) => (
            <FadeIn key={item.title} delay={index * 100}>
              <Link
                href={item.href}
                className="group block bg-white rounded-2xl p-8 border border-gray-200/50 hover:border-gray-300 hover:shadow-lg transition-all duration-300 h-full"
              >
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-eza-gray mb-4 group-hover:bg-eza-gray/80 transition-colors duration-300">
                    <Icon name={item.icon} className="text-eza-text" size={28} />
                  </div>
                  <h3 className="text-2xl font-semibold text-eza-text mb-3 group-hover:text-eza-blue transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-eza-text-secondary leading-relaxed text-base">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center text-eza-blue font-medium text-sm group-hover:gap-2 gap-1 transition-all">
                  Daha fazla bilgi
                  <Icon name="ArrowRight" size={16} />
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
