import Link from "next/link";
import Icon from "./Icon";

export default function Footer() {
  return (
    <footer className="bg-eza-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-eza-blue to-eza-blue/70 flex items-center justify-center">
                <Icon name="Shield" className="text-white" size={24} />
              </div>
              <span className="text-2xl font-bold">EZA.global</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Teknolojinin insanlığa karşı etik davranmasını sağlayan rehber.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-eza-blue transition-colors flex items-center justify-center">
                <Icon name="Twitter" size={20} />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-eza-blue transition-colors flex items-center justify-center">
                <Icon name="Linkedin" size={20} />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-eza-blue transition-colors flex items-center justify-center">
                <Icon name="Github" size={20} />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Icon name="Package" size={20} />
              Products
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/products/standalone"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Standalone
                </Link>
              </li>
              <li>
                <Link
                  href="/products/proxy"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Proxy
                </Link>
              </li>
              <li>
                <Link
                  href="/products/proxy-lite"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Proxy-Lite
                </Link>
              </li>
            </ul>
          </div>

          {/* Panels */}
          <div>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Icon name="LayoutDashboard" size={20} />
              Panels
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/panels/regulator"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Regulator Panel
                </Link>
              </li>
              <li>
                <Link
                  href="/panels/corporate"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Corporate Panel
                </Link>
              </li>
              <li>
                <Link
                  href="/panels/developer"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Developer Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Icon name="FileText" size={20} />
              Resources
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/documentation"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/whitepaper"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Whitepaper
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-2 group"
                >
                  <Icon name="ArrowRight" size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} EZA.global. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>Made with</span>
              <Icon name="Heart" size={16} className="text-red-500" />
              <span>for ethical technology</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
