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
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
            EZA Ekosistemi
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Teknolojinin etik kullanımı için kapsamlı platform ve araçlar
          </p>
        </div>
      </FadeIn>

      {/* Tabs */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex bg-white rounded-xl p-2 shadow-lg border border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-eza-blue text-white shadow-md"
                  : "text-gray-600 hover:text-eza-blue hover:bg-eza-gray/50"
              }`}
            >
              <Icon name={tab.icon} size={20} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getActiveItems().map((item, index) => (
            <FadeIn key={item.title} delay={index * 100}>
              <Link
                href={item.href}
                className="group block bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-eza-blue/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-eza-blue/10 to-eza-blue/5 mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Icon name={item.icon} className="text-eza-blue" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-eza-dark mb-3 group-hover:text-eza-blue transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed text-sm">
                    {item.description}
                  </p>
                  <span className="inline-flex items-center text-eza-blue font-semibold text-sm group-hover:gap-2 gap-1 transition-all">
                    Detayları gör
                    <Icon name="ArrowRight" size={16} />
                  </span>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

