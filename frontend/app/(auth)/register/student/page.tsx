"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { registerStudentSchema, RegisterStudentFormValues } from "@/schemas/auth.schema";
import { authService } from "@/services/auth.service";
import { extractErrorMessage } from "@/lib/api-client";
import { usePublicCourses } from "@/hooks/useCourses";
import { LoginMascot } from "@/components/auth/login/login-mascot";
import styles from "@/components/auth/login/login.module.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function RegisterStudentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Presentation only: the mascot covers its eyes while a password field is focused.
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { data: courses, isLoading: isLoadingCourses } = usePublicCourses();
  const form = useForm<RegisterStudentFormValues>({
    resolver: zodResolver(registerStudentSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      dateOfBirth: "",
      gender: undefined,
      highestQualification: "",
      college: "",
      courseId: "",
      guardianPhone: "",
      acceptedPrivacyPolicy: false,
    },
  });

  async function onSubmit(values: RegisterStudentFormValues) {
    setIsSubmitting(true);
    try {
      const result = await authService.registerStudent(values);
      toast.success("Registration submitted. Check your email for a verification code.");
      router.push(`/verify-otp?email=${encodeURIComponent(result.email)}`);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.panelStack} style={{ maxWidth: "32rem" }}>
      <LoginMascot mood={passwordFocused ? "cover" : "watch"} gaze={0.5} />
      <Card className="relative z-[1] w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Student registration</CardTitle>
          <CardDescription>
            Create your account. An admin will review and approve it before you can log in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              onFocus={(e) => {
                const name = e.target instanceof HTMLInputElement ? e.target.name : "";
                setPasswordFocused(name === "password" || name === "confirmPassword");
              }}
              onBlur={() => setPasswordFocused(false)}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="courseId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Course</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={isLoadingCourses ? "Loading courses..." : "Select a course"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {courses?.length ? (
                            courses.map((course) => (
                              <SelectItem key={course._id} value={course._id}>
                                {course.name} · {course.duration}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                              {isLoadingCourses ? "Loading courses..." : "No courses available yet."}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="9876543210" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="guardianPhone"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Parent / spouse mobile number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="9876543210" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of birth</FormLabel>
                      <FormControl>
                        <DatePicker {...field} yearNavigation disableFuture placeholder="Select date of birth" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="highestQualification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Highest qualification</FormLabel>
                      <FormControl>
                        <Input placeholder="B.Tech" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="college"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>College / institution</FormLabel>
                      <FormControl>
                        <Input placeholder="Your college" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="acceptedPrivacyPolicy"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-start gap-2">
                      <FormControl>
                        <Checkbox
                          className="mt-0.5"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="block font-normal leading-snug text-muted-foreground">
                        I have read and agree to the{" "}
                        <Link
                          href="/privacy-policy"
                          target="_blank"
                          className="font-medium text-primary hover:underline"
                        >
                          Privacy Policy &amp; Student Terms
                        </Link>
                        , including that fees once paid are non-refundable.
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Create account"}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
