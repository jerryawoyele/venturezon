import { useState, useRef, ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PlusCircle, Image, Upload, X, FileImage, Loader2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LocalImageUpload } from "./LocalImageUpload";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import ProfileImage from "@/components/ProfileImage";
import { User } from "@supabase/supabase-js";
import { Profile } from "@/types";

interface CreatePostProps {
  onSubmit: (data: { text: string; image_url: string | string[]; isTextPost: boolean }) => Promise<void>;
  className?: string;
}

export function CreatePost({ onSubmit, className = "" }: CreatePostProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isTextPost, setIsTextPost] = useState(true);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        
        // Get user profile data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
          
        if (profileData) {
          setUserProfile(profileData);
        }
      }
    }
    
    getUser();
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() && imageUrls.length === 0) return;
    
    setLoading(true);
    try {
      let imageUrl;
      
      if (!isTextPost) {
        if (imageUrls.length > 0) {
          // If there are multiple images, store them as a JSON array
          imageUrl = imageUrls.length === 1 ? imageUrls[0] : JSON.stringify(imageUrls);
        }
      } else {
        imageUrl = 'text'; // Mark as text post explicitly
      }

      await onSubmit({
        text: text.trim(),
        image_url: imageUrl,
        isTextPost
      });
      
      setText("");
      setImageUrls([]);
      setImagePreviews([]);
      setOpen(false);
    } catch (error) {
      console.error("Error submitting post:", error);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Limit to 8 images total
    const remainingSlots = 8 - imageUrls.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImageUrls(prev => [...prev, result]);
        setImagePreviews(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prevUrls => prevUrls.filter((_, i) => i !== index));
    setImagePreviews(prevPreviews => prevPreviews.filter((_, i) => i !== index));
  };

  const togglePostType = () => {
    setIsTextPost(!isTextPost);
  };

  return (
    <>
      <Card className={`p-6 bg-card border-border ${className}`}>
        <div className="flex items-center gap-3">
          <ProfileImage 
            src={userProfile?.avatar_url || user?.user_metadata?.avatar_url}
            alt={userProfile?.username || user?.user_metadata?.full_name || "User"}
            className="w-10 h-10 rounded-full"
          />
          <button
            className="flex-1 bg-background hover:bg-secondary rounded-md px-4 py-3 text-left text-muted-foreground cursor-pointer transition-colors"
            onClick={() => setOpen(true)}
          >
            What's happening in your business?
          </button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-hidden">
          <DialogHeader className="mb-4">
            <DialogTitle>Create Post</DialogTitle>
            <DialogDescription>
              Share updates about your business with the community
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-11rem)] pb-4">
            <div className="flex gap-3 mb-4">
              <Button 
                variant={isTextPost ? "default" : "outline"} 
                onClick={() => setIsTextPost(true)}
                className="flex-1"
              >
                Text Post
              </Button>
              <Button 
                variant={!isTextPost ? "default" : "outline"} 
                onClick={() => setIsTextPost(false)}
                className="flex-1"
              >
                Image Post
              </Button>
            </div>
            
            <div className="space-y-4">
              {isTextPost ? (
                <div>
                  <Label htmlFor="post-text">Text Content</Label>
                  <Textarea
                    id="post-text"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[200px]"
                    placeholder="Share your thoughts, updates, or services..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">This will create a text-based post.</p>
                </div>
              ) : (
                <>
                  {/* Caption input for image posts */}
                  <div>
                    <Label htmlFor="post-caption">Caption</Label>
                    <Textarea
                      id="post-caption"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[100px]"
                      placeholder="Add a caption to your images..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </div>
                  
                  {/* Multiple image upload */}
                  <div className="space-y-2">
                    <Label>Upload Images (max 8)</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative w-24 h-24 border border-white/10 rounded-md overflow-hidden">
                          <img src={preview} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      
                      {imagePreviews.length < 8 && (
                        <button 
                          type="button" 
                          className="w-24 h-24 border border-dashed border-white/20 rounded-md flex items-center justify-center"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <PlusCircle size={24} className="text-white/40" />
                        </button>
                      )}
                    </div>
                    
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                    />
                    
                    <p className="text-xs text-muted-foreground mt-1">
                      {imagePreviews.length === 0 
                        ? "Select up to 8 images to upload" 
                        : `${imagePreviews.length} image${imagePreviews.length !== 1 ? 's' : ''} selected (${8 - imagePreviews.length} remaining)`}
                    </p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || (isTextPost ? !text.trim() : (!text.trim() && imageUrls.length === 0))}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : "Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
