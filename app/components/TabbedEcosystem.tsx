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
    <div className="relative">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-semibold text-eza-text mb-4">
              EZA Ekosistemi
            </h2>
            <p className="text-xl text-eza-text-secondary max-w-2xl mx-auto">
              Teknolojinin etik kullanımı için kapsamlı platform ve araçlar
            </p>
          </div>
        </FadeIn>

        {/* Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-white rounded-lg p-1 border border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-eza-blue text-white"
                    : "text-eza-text-secondary hover:text-eza-text hover:bg-eza-gray"
                }`}
              >
                <Icon name={tab.icon} size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getActiveItems().map((item, index) => (
              <FadeIn key={item.title} delay={index * 50}>
                <Link
                  href={item.href}
                  className="block bg-white rounded-lg p-6 border border-gray-200 hover:border-eza-blue hover:shadow-md transition-all h-full"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                      <Icon name={item.icon} className="text-eza-blue" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-eza-text mb-2">
                        {item.title}
                      </h3>
                      <p className="text-eza-text-secondary leading-relaxed text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-eza-blue font-medium text-sm mt-4">
                    Daha fazla bilgi
                    <Icon name="ArrowRight" size={16} className="ml-1" />
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
