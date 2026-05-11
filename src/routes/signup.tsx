import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Register — SmartRail KZN" }] }),
  component: SignupPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Required").max(100),
  email: z.string().trim().email().max(255),
  phone_number: z.string().trim().regex(/^[0-9+\s-]{8,15}$/, "Enter a valid phone number"),
  password: z.string().min(6, "At least 6 characters").max(72),
});
type FormData = z.infer<typeof schema>;

function SignupPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/tickets" });
  }, [user, loading, nav]);

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/tickets`;
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: data.full_name, phone_number: data.phone_number },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. Welcome aboard.");
    nav({ to: "/tickets" });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-lg font-semibold mb-1">Register a commuter account</h1>
      <p className="text-xs text-muted-foreground mb-5">
        Staff and supervisor accounts are provisioned by an administrator.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="panel p-5 space-y-4">
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" {...register("full_name")} />
          {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="phone_number">Mobile number</Label>
          <Input id="phone_number" placeholder="+27 71 234 5678" {...register("phone_number")} />
          {errors.phone_number && <p className="text-xs text-destructive mt-1">{errors.phone_number.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
        </div>
        <Button type="submit" disabled={!isValid || submitting} className="w-full">
          {submitting ? "Creating…" : "Create account"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Already registered?{" "}
          <Link to="/login" className="text-rail hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
