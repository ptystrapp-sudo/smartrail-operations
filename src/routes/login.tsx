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
import { Train } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SmartRail KZN" }] }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});
type FormData = z.infer<typeof schema>;

function LoginPage() {
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
    const { error } = await supabase.auth.signInWithPassword(data);
    setSubmitting(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Email or password is incorrect"
        : error.message);
      return;
    }
    toast.success("Signed in");
    nav({ to: "/tickets" });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
          <Train className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Sign in to SmartRail</h1>
          <p className="text-xs text-muted-foreground">Commuters, station staff, and supervisors</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="panel p-5 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
        </div>
        <Button type="submit" disabled={!isValid || submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          No account?{" "}
          <Link to="/signup" className="text-rail underline-offset-2 hover:underline">Register as commuter</Link>
        </p>
      </form>
    </div>
  );
}
