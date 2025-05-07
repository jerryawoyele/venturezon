import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServiceAdded: (service: any) => void;
}

const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(100),
  description: z.string().min(20, "Description must be at least 20 characters"),
  price: z.number().min(0, "Price must be a non-negative number"),
  currency_created_in: z.string().default("NGN"),
  category: z.string().min(2, "Please select a category"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  is_price_range: z.boolean().default(false).optional(),
  duration_minutes: z.number().min(1, "Duration must be at least 1 minute"),
});

// Try these buckets in order
const STORAGE_BUCKETS = ['services', 'public', 'images'];

export function AddServiceModal({ isOpen, onClose, onServiceAdded }: AddServiceModalProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  // Generate a unique ID for this instance of the form
  const serviceIdRef = useRef(uuidv4());

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Generate a new unique ID each time the modal opens
      serviceIdRef.current = uuidv4();
      reset();
      setImageFile(null);
      setImagePreview(null);
      setImageError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      currency_created_in: "NGN",
      category: "",
      location: "",
      is_price_range: false,
      duration_minutes: 60,
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = form;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageError(null);
    
    if (!file) return;

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be less than 5MB");
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setImageError("Only JPEG, PNG, and WEBP images are allowed");
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File, userId: string): Promise<string | null> => {
    try {
      setUploadProgress(0);
      
      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${serviceIdRef.current}.${fileExt}`;
      const filePath = `services/${userId}/${fileName}`;
      
      // Try each bucket in order
      let uploadError = null;
      let publicUrl = null;

      for (const bucket of STORAGE_BUCKETS) {
        try {
          console.log(`Trying to upload to bucket: ${bucket}`);
          const { error, data } = await supabase.storage
            .from(bucket)
            .upload(`${filePath}`, file, {
              cacheControl: '3600',
              upsert: true, // Use upsert to avoid duplicates
            });

          if (error) {
            console.log(`Error with bucket ${bucket}:`, error);
            uploadError = error;
            continue; // Try next bucket
          }
          
          // Upload successful, get URL
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(`${filePath}`);
            
          publicUrl = urlData.publicUrl;
          console.log(`Successfully uploaded to bucket: ${bucket}`);
          break; // Exit the loop if successful
        } catch (err) {
          console.error(`Error trying bucket ${bucket}:`, err);
          continue; // Try next bucket
        }
      }

      if (!publicUrl) {
        // If we get here, all buckets failed
        throw uploadError || new Error("Failed to upload to any storage bucket");
      }
      
      setUploadProgress(100);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add a service",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent submission if already loading
    if (loading) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Upload image if provided
      let imageUrl = null;
      if (imageFile) {
        try {
          imageUrl = await uploadImage(imageFile, user.id);
        } catch (error: any) {
          console.error("Storage error details:", error);
          toast({
            title: "Image Upload Failed",
            description: "Unable to upload image. The service will be created without an image.",
            variant: "destructive",
          });
          // Continue without image
          console.warn("Continuing without image due to storage error");
        }
      }

      // Prepare service data
      const serviceData = {
        title: values.title,
        description: values.description,
        price: values.price,
        currency_created_in: values.currency_created_in,
        category: values.category,
        location: values.location,
        is_price_range: values.is_price_range,
        duration_minutes: values.duration_minutes,
        owner_id: user.id,
        image: imageUrl,
        ratings_count: 0,
        ratings_sum: 0,
      };

      // Insert into the services table
      const { data, error } = await supabase
        .from("services")
        .insert(serviceData)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Service created",
        description: "Your service has been created successfully",
      });

      // Reset form and close modal
      reset();
      setImageFile(null);
      setImagePreview(null);
      setImageError(null);
      // Call onServiceAdded with the data and immediately close
      onServiceAdded(data);
      onClose();
    } catch (error: any) {
      console.error("Error adding service:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while adding the service",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      setImageFile(null);
      setImagePreview(null);
      setImageError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
    }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Add New Service</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 overflow-auto max-h-[calc(90vh-8rem)]">
          <form 
            id="service-form" 
            className="space-y-4 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="space-y-2 px-2">
              <Label htmlFor="title">Service Title</Label>
              <Input
                id="title"
                placeholder="e.g. Home Cleaning Service"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2 px-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your service in detail..."
                className="min-h-[100px]"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 px-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  onValueChange={(value) => form.setValue("category", value)}
                  defaultValue={form.getValues("category")}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="repair">Repair & Maintenance</SelectItem>
                    <SelectItem value="health">Health & Wellness</SelectItem>
                    <SelectItem value="education">Education & Tutoring</SelectItem>
                    <SelectItem value="tech">Tech Support</SelectItem>
                    <SelectItem value="beauty">Beauty & Spa</SelectItem>
                    <SelectItem value="delivery">Delivery & Errands</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-500">{errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <div className="flex">
                  <Input
                    id="price"
                    type="number"
                    placeholder="0.00"
                    {...form.register("price", { valueAsNumber: true })}
                  />
                </div>
                {errors.price && (
                  <p className="text-sm text-red-500">{errors.price.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="currency_created_in">Currency</Label>
                <Select
                  onValueChange={(value) => form.setValue("currency_created_in", value)}
                  defaultValue={form.getValues("currency_created_in")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">Nigerian Naira (NGN)</SelectItem>
                    <SelectItem value="USD">US Dollar (USD)</SelectItem>
                    <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                    <SelectItem value="EUR">Euro (EUR)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.currency_created_in && (
                  <p className="text-sm text-red-500">{errors.currency_created_in.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 px-2">
              <div className="space-y-2">
                <Label htmlFor="location">Service Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. New York City"
                  {...register("location")}
                />
                {errors.location && (
                  <p className="text-sm text-red-500">{errors.location.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  placeholder="60"
                  step="1"
                  min="1"
                  max="1440"
                  {...register("duration_minutes")}
                />
                {errors.duration_minutes && (
                  <p className="text-sm text-red-500">{errors.duration_minutes.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 px-2">
              <Label htmlFor="image">Service Image (Optional)</Label>
              <div className="grid grid-cols-1 gap-4">
                {imagePreview && (
                  <div className="relative w-full aspect-video rounded-md overflow-hidden bg-white/5">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-gray-500 dark:text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PNG, JPG or WEBP (MAX. 5MB)
                      </p>
                    </div>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
                {imageError && (
                  <p className="text-sm text-red-500">{imageError}</p>
                )}
              </div>
            </div>
          </form>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t">
          <Button variant="outline" type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleSubmit(onSubmit)()}
            disabled={loading}
            type="button"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
