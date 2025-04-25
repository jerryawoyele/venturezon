import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-12">
      <div className="container px-4 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">About</h3>
            <ul className="space-y-2">
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">About Us</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Careers</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Press</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Resources</h3>
            <ul className="space-y-2">
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Blog</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Help Center</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Guidelines</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Legal</h3>
            <ul className="space-y-2">
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Privacy</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Terms</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Cookie Policy</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Contact</h3>
            <ul className="space-y-2">
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Support</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Sales</Link></li>
              <li><Link to="#" className="text-foreground/70 hover:text-foreground">Partners</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border text-center text-foreground/70">
          <p>&copy; {new Date().getFullYear()} Venturezon. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
