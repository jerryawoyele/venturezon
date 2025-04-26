import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { SearchUsers } from "./SearchUsers";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

interface MobileHeaderProps {
  onSearch?: (query: string) => void;
  unreadNotifications?: number;
  unreadMessages?: number;
}

export function MobileHeader({ 
  onSearch, 
  unreadNotifications = 0, 
  unreadMessages = 0 
}: MobileHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === "/home";
  const isMediumScreen = window.innerWidth >= 768 && window.innerWidth < 1024;

  // Handle clicks outside to close search results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If click was not on search bar or results, close results
      if (!target.closest('.search-container') && showResults) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showResults]);

  // Only render on home page or on medium screens for specific paths
  if (!isHomePage && !(isMediumScreen && location.pathname === "/home")) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(value.length > 0);
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchQuery);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setShowResults(false);
    if (onSearch) {
      onSearch("");
    }
  };

  const handleSearchClose = () => {
    setShowResults(false);
  };

  return (
    <div className="flex flex-row items-center justify-between bg-card dark:bg-[hsl(240,10%,12%)] border-b border-border p-4 lg:hidden fixed top-0 left-0 right-0 z-50">
      <Link to="/" className="flex items-center space-x-2">
        <span className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">Venturezon</span>
      </Link>
      
      <div className="relative search-container ml-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search..."
            className="pl-9 max-md:w-[160px] md:[320px] pr-8 bg-background border-input focus:border-ring transition-colors"
            value={searchQuery}
            onChange={handleChange}
            onKeyPress={handleSearch}
            onFocus={() => setShowResults(true)}
          />
          {searchQuery && (
            <button 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={clearSearch}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="w-full absolute left-0 right-0 z-50">
          <SearchUsers 
            searchQuery={searchQuery} 
            show={showResults} 
            onClose={handleSearchClose} 
          />
        </div>
      </div>
    </div>
  );
}
