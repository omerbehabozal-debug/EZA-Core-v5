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
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 rounded-full mb-6">
            <Icon name="HelpCircle" className="text-eza-blue" size={20} />
            <span className="text-sm font-semibold text-eza-blue">SSS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
            Sık Sorulan Sorular
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            EZA hakkında merak ettikleriniz
          </p>
        </div>
      </FadeIn>
      <div className="space-y-4">
        {faqItems.map((item, index) => (
          <FadeIn key={index} delay={index * 100}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-eza-gray/50 transition-colors group"
              >
                <span className="font-semibold text-eza-dark text-lg pr-4 group-hover:text-eza-blue transition-colors">
                  {item.question}
                </span>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-eza-blue/10 flex items-center justify-center transition-transform ${openIndex === index ? 'rotate-180' : ''}`}>
                  <Icon 
                    name="ChevronDown" 
                    className="text-eza-blue" 
                    size={20} 
                  />
                </div>
              </button>
              {openIndex === index && (
                <div className="px-6 py-5 bg-eza-gray/30 text-gray-700 leading-relaxed border-t border-gray-100 animate-in fade-in">
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
