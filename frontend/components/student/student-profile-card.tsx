"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { useUpdateStudentProfile } from "@/hooks/useProfile";
import { studentProfileFormSchema, StudentProfileFormValues } from "@/schemas/profile.schema";
import { StudentProfileData } from "@/types/profile";

function toDefaults(profile: StudentProfileData | null): StudentProfileFormValues {
  return {
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
    gender: profile?.gender,
    address: profile?.address ?? "",
    highestQualification: profile?.highestQualification ?? "",
    college: profile?.college ?? "",
    graduationYear: profile?.graduationYear,
    percentageOrCgpa: profile?.percentageOrCgpa ?? "",
    skillsText: profile?.skills?.join(", ") ?? "",
    experience: profile?.experience ?? "",
    resumeUrl: profile?.resumeUrl ?? "",
    portfolioUrl: profile?.portfolioUrl ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
    githubUrl: profile?.githubUrl ?? "",
  };
}

export function StudentProfileCard({ profile }: { profile: StudentProfileData | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMutation = useUpdateStudentProfile();

  const form = useForm<StudentProfileFormValues>({
    resolver: zodResolver(studentProfileFormSchema),
    defaultValues: toDefaults(profile),
  });

  function startEdit() {
    form.reset(toDefaults(profile));
    setIsEditing(true);
  }

  function handleSubmit(values: StudentProfileFormValues) {
    updateMutation.mutate(
      {
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender,
        address: values.address || undefined,
        highestQualification: values.highestQualification || undefined,
        college: values.college || undefined,
        graduationYear: values.graduationYear,
        percentageOrCgpa: values.percentageOrCgpa || undefined,
        skills: values.skillsText
          ? values.skillsText.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        experience: values.experience || undefined,
        resumeUrl: values.resumeUrl || undefined,
        portfolioUrl: values.portfolioUrl || undefined,
        linkedinUrl: values.linkedinUrl || undefined,
        githubUrl: values.githubUrl || undefined,
      },
      { onSuccess: () => setIsEditing(false) }
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Education &amp; Professional Details</CardTitle>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
                        <Input {...field} />
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
                      <FormLabel>College</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="graduationYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Graduation year</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="percentageOrCgpa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentage / CGPA</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skillsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills</FormLabel>
                    <FormControl>
                      <Input placeholder="React, Node.js, MongoDB" {...field} />
                    </FormControl>
                    <FormDescription>Separate skills with commas.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experience</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="resumeUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resume URL</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="portfolioUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Portfolio URL</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub URL</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Highest qualification</dt>
                <dd className="font-medium">{profile?.highestQualification ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">College</dt>
                <dd className="font-medium">{profile?.college ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Graduation year</dt>
                <dd className="font-medium">{profile?.graduationYear ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Percentage / CGPA</dt>
                <dd className="font-medium">{profile?.percentageOrCgpa ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Parent / spouse mobile</dt>
                <dd className="font-medium">{profile?.guardianPhone ?? "—"}</dd>
              </div>
            </dl>

            {profile?.skills && profile.skills.length > 0 && (
              <div>
                <p className="mb-1.5 text-muted-foreground">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              {profile?.resumeUrl && (
                <a href={profile.resumeUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Resume
                </a>
              )}
              {profile?.portfolioUrl && (
                <a href={profile.portfolioUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Portfolio
                </a>
              )}
              {profile?.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  LinkedIn
                </a>
              )}
              {profile?.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  GitHub
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
