import Link from "next/link";
import Icon from "./Icon";

export default function Footer() {
  return (
    <footer className="bg-eza-gray border-t border-gray-200/50">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <span className="text-xl font-semibold text-eza-text">EZA.global</span>
            </div>
            <p className="text-eza-text-secondary text-sm leading-relaxed mb-6">
              Teknolojinin insanlığa karşı etik davranmasını sağlayan rehber.
            </p>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold text-eza-text mb-4">Products</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/products/standalone"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Standalone
                </Link>
              </li>
              <li>
                <Link
                  href="/products/proxy"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Proxy
                </Link>
              </li>
              <li>
                <Link
                  href="/products/proxy-lite"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Proxy-Lite
                </Link>
              </li>
            </ul>
          </div>

          {/* Panels */}
          <div>
            <h3 className="text-sm font-semibold text-eza-text mb-4">Panels</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/panels/regulator"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Regulator Panel
                </Link>
              </li>
              <li>
                <Link
                  href="/panels/corporate"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Corporate Panel
                </Link>
              </li>
              <li>
                <Link
                  href="/panels/developer"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Developer Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-eza-text mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/documentation"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/whitepaper"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Whitepaper
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-eza-text-secondary text-sm">
              &copy; {new Date().getFullYear()} EZA.global. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
