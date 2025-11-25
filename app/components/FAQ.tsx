"use client";

import { useState } from "react";
import { faqItems } from "@/lib/constants";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-4xl mx-auto">
      <FadeIn>
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-semibold text-eza-text mb-6 tracking-tight">
            Sık Sorulan Sorular
          </h2>
          <p className="text-2xl text-eza-text-secondary font-light max-w-2xl mx-auto">
            EZA hakkında merak ettikleriniz
          </p>
        </div>
      </FadeIn>
      <div className="space-y-3">
        {faqItems.map((item, index) => (
          <FadeIn key={index} delay={index * 100}>
            <div className="bg-white rounded-2xl border border-gray-200/50 hover:border-gray-300 hover:shadow-lg overflow-hidden transition-all duration-300">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-8 py-6 text-left flex justify-between items-center hover:bg-eza-gray/30 transition-colors group"
              >
                <span className="font-semibold text-eza-text text-lg pr-4 group-hover:text-eza-blue transition-colors">
                  {item.question}
                </span>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-eza-gray flex items-center justify-center transition-all duration-300 ${openIndex === index ? 'rotate-180 bg-eza-blue/10' : 'group-hover:bg-eza-gray/80'}`}>
                  <Icon 
                    name="ChevronDown" 
                    className={openIndex === index ? "text-eza-blue" : "text-eza-text"} 
                    size={20} 
                  />
                </div>
              </button>
              {openIndex === index && (
                <div className="px-8 py-6 bg-gradient-to-br from-eza-gray/50 to-white text-eza-text-secondary leading-relaxed border-t border-gray-200/50 animate-in fade-in text-base">
                  {item.answer}
                </div>
              )}
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
