"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "./Icon";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);

  const navigation = [
    { name: "Ecosystem", href: "/#ecosystem" },
    { name: "Hakkımızda", href: "/about" },
      {
        name: "EZA-Core Products",
        href: "#",
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
        { name: "EU AI Act Compliance", href: "/panels/eu-ai-act" },
        { name: "Select Portal", href: "/panels/select-portal" },
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
        { name: "Humanoid Robots", href: "/solutions/humanoid-robots" },
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
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="flex items-center gap-2 group"
              onClick={() => {
                // Home link'e tıklanınca scroll pozisyonunu temizle
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('homeScrollPosition');
                  sessionStorage.removeItem('homeScrollSection');
                }
              }}
            >
              <span className="text-xl font-semibold text-eza-text">EZA</span>
            </Link>
            <span className="hidden sm:inline-block px-2.5 py-0.5 bg-eza-blue/10 text-eza-blue text-xs font-medium rounded-full border border-eza-blue/20">
              Etik Zeka Altyapısı
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigation.map((item) => {
              if (item.children) {
                const isOpen = 
                  (item.name === "EZA-Core Products" && productsOpen) ||
                  (item.name === "Panels" && panelsOpen) ||
                  (item.name === "Solutions" && solutionsOpen);

                return (
                  <div
                    key={item.name}
                    className="relative group"
                    onMouseEnter={() => {
                      if (item.name === "EZA-Core Products") setProductsOpen(true);
                      if (item.name === "Panels") setPanelsOpen(true);
                      if (item.name === "Solutions") setSolutionsOpen(true);
                    }}
                    onMouseLeave={() => {
                      if (item.name === "EZA-Core Products") setProductsOpen(false);
                      if (item.name === "Panels") setPanelsOpen(false);
                      if (item.name === "Solutions") setSolutionsOpen(false);
                    }}
                  >
                    <button className={`px-4 py-2 text-eza-text-secondary hover:text-eza-text transition-colors text-sm font-medium relative ${
                      item.name === "EZA-Core Products" 
                        ? "flex flex-col items-center justify-center leading-[1.1] whitespace-nowrap min-w-[110px] pr-6" 
                        : "flex items-center gap-1"
                    }`}>
                      {item.name === "EZA-Core Products" ? (
                        <>
                          <span className="block">EZA-Core</span>
                          <span className="block -mt-0.5">Products</span>
                          <Icon name="ChevronDown" size={14} className="absolute right-2 top-1/2 -translate-y-1/2" />
                        </>
                      ) : (
                        <>
                          {item.name}
                          <Icon name="ChevronDown" size={14} />
                        </>
                      )}
                    </button>
                    {isOpen ? (
                      <div 
                        className="absolute top-full left-0 pt-2 w-64 z-50"
                        onMouseEnter={() => {
                          if (item.name === "EZA-Core Products") setProductsOpen(true);
                          if (item.name === "Panels") setPanelsOpen(true);
                          if (item.name === "Solutions") setSolutionsOpen(true);
                        }}
                        onMouseLeave={() => {
                          if (item.name === "EZA-Core Products") setProductsOpen(false);
                          if (item.name === "Panels") setPanelsOpen(false);
                          if (item.name === "Solutions") setSolutionsOpen(false);
                        }}
                      >
                        <div className="bg-white rounded-xl shadow-xl border border-gray-200/50 py-2 animate-in fade-in slide-in-from-top-2">
                          {item.children?.map((child) => (
                            <Link
                              key={child.name}
                              href={child.href}
                              className="block px-4 py-2.5 text-sm text-eza-text-secondary hover:text-eza-text hover:bg-eza-gray/50 transition-colors rounded-lg mx-1"
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }
              const DesktopLinkComponent = (item as any).external ? "a" : Link;
              const desktopLinkProps = (item as any).external
                ? {
                    href: item.href,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  }
                : {
                    href: item.href,
                    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
                      if (item.href.startsWith("#")) {
                        e.preventDefault();
                        handleScrollTo(item.href);
                      }
                    },
                  };

              return (
                <DesktopLinkComponent
                  key={item.name}
                  {...desktopLinkProps}
                  className="px-4 py-2 text-eza-text-secondary hover:text-eza-text transition-colors text-sm font-medium flex items-center gap-1"
                >
                  {item.name}
                  {(item as any).external && <Icon name="ExternalLink" size={14} />}
                </DesktopLinkComponent>
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
              const LinkComponent = (item as any).external ? "a" : Link;
              const linkProps = (item as any).external
                ? {
                    href: item.href,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    onClick: () => setMobileMenuOpen(false),
                  }
                : {
                    href: item.href,
                    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
                      if (item.href.startsWith("#")) {
                        e.preventDefault();
                        handleScrollTo(item.href);
                      }
                      setMobileMenuOpen(false);
                    },
                  };

              return (
                <LinkComponent
                  key={item.name}
                  {...linkProps}
                  className="px-3 py-2 text-eza-text-secondary hover:text-eza-text hover:bg-eza-gray/50 rounded-lg transition-colors text-sm font-medium block"
                >
                  {item.name}
                  {(item as any).external && (
                    <Icon name="ExternalLink" size={12} className="inline ml-1" />
                  )}
                </LinkComponent>
              );
            })}
          </div>
        )}
      </nav>
    </header>
  );
}
