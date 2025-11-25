"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "./Icon";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  const navigation = [
    { name: "Home", href: "/" },
    { name: "Ecosystem", href: "/#ecosystem" },
    {
      name: "Products",
      children: [
        { name: "Standalone", href: "/products/standalone" },
        { name: "Proxy", href: "/products/proxy" },
        { name: "Proxy-Lite", href: "/products/proxy-lite" },
      ],
    },
    {
      name: "Panels",
      children: [
        { name: "Regulator Panel", href: "/panels/regulator" },
        { name: "Corporate Panel", href: "/panels/corporate" },
        { name: "Developer Console", href: "/panels/developer" },
      ],
    },
    {
      name: "Solutions",
      children: [
        { name: "Education", href: "/solutions/education" },
        { name: "Banking", href: "/solutions/banking" },
        { name: "Healthcare", href: "/solutions/healthcare" },
        { name: "Corporate", href: "/solutions/corporate" },
        { name: "Autonomous", href: "/solutions/autonomous" },
        { name: "Media", href: "/solutions/media" },
        { name: "Public Sector", href: "/solutions/public-sector" },
      ],
    },
    { name: "Documentation", href: "/documentation" },
    { name: "Contact", href: "/contact" },
  ];

  const handleScrollTo = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/50">
      <nav className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-xl font-semibold text-eza-text">EZA.global</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigation.map((item) => {
              if (item.children) {
                return (
                  <div
                    key={item.name}
                    className="relative group"
                    onMouseEnter={() => {
                      if (item.name === "Products") setProductsOpen(true);
                      if (item.name === "Panels") setPanelsOpen(true);
                      if (item.name === "Solutions") setSolutionsOpen(true);
                    }}
                    onMouseLeave={() => {
                      if (item.name === "Products") setProductsOpen(false);
                      if (item.name === "Panels") setPanelsOpen(false);
                      if (item.name === "Solutions") setSolutionsOpen(false);
                    }}
                  >
                    <button className="px-4 py-2 text-eza-text-secondary hover:text-eza-text transition-colors text-sm font-medium flex items-center gap-1">
                      {item.name}
                      <Icon name="ChevronDown" size={14} />
                    </button>
                    {(item.name === "Products" && productsOpen) ||
                    (item.name === "Panels" && panelsOpen) ||
                    (item.name === "Solutions" && solutionsOpen) ? (
                      <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200/50 py-2 animate-in fade-in slide-in-from-top-2">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            className="block px-4 py-2.5 text-sm text-eza-text-secondary hover:text-eza-text hover:bg-eza-gray/50 transition-colors rounded-lg mx-1"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href.startsWith("#")) {
                      e.preventDefault();
                      handleScrollTo(item.href);
                    }
                  }}
                  className="px-4 py-2 text-eza-text-secondary hover:text-eza-text transition-colors text-sm font-medium"
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden text-eza-text p-2 hover:bg-eza-gray/50 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <Icon name="X" size={24} />
            ) : (
              <Icon name="Menu" size={24} />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 space-y-1 border-t border-gray-200/50 mt-2">
            {navigation.map((item) => {
              if (item.children) {
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="text-eza-text font-medium px-3 py-2 text-sm">
                      {item.name}
                    </div>
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.href}
                        className="block px-6 py-2 text-sm text-eza-text-secondary hover:text-eza-text hover:bg-eza-gray/50 rounded-lg transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                );
              }
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href.startsWith("#")) {
                      e.preventDefault();
                      handleScrollTo(item.href);
                    }
                    setMobileMenuOpen(false);
                  }}
                  className="block px-3 py-2 text-eza-text-secondary hover:text-eza-text hover:bg-eza-gray/50 rounded-lg transition-colors text-sm font-medium"
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </header>
  );
}
