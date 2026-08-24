import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useParams } from 'react-router';
import { ZodType, z } from 'zod';
import { UpdateUser, UserService } from '../../api/client';
import { Button } from '../../shadcn/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../shadcn/ui/form';
import { Input } from '../../shadcn/ui/input';
import { Switch } from '../../shadcn/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../../shadcn/ui/toggle-group';
import { UserDataAtom } from '../../store/store';
import {
  parseFormTime,
  parseUserSaveTime,
  parseUserWeekDay,
  setCredentials,
  singleWeekDay,
  updateUserDataV2,
  weekDays,
} from '../../utils/dbManager';

const updateUserSchema = z.object({
  send_mail: z.boolean().optional(),
  email: z.string().optional(),
  dw_playlist_id: z.string().min(20, {
    message: 'DW playlist id must be at least 20 characters.',
  }),
  save_weekday: z.enum(weekDays).optional(),
  save_hour_minute: z.string({
    message: 'Save time must be at least 5 characters. ex: 16:00',
  }),
  tg_chat_id: z.string().optional(),
}) satisfies ZodType<UpdateUser>;

type FormData = z.infer<typeof updateUserSchema>;

export const SettingsForm = () => {
  const [userData, setUserData] = useAtom(UserDataAtom);
  const { userId } = useParams();
  const form = useForm<FormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: '',
      tg_chat_id: '',
      save_weekday: 'Mo',
      save_hour_minute: '00:00',
      dw_playlist_id: '',
    },
  });
  const sendMailValue = useWatch({ name: 'send_mail', control: form.control });

  async function onSubmit(values: FormData) {
    const updateUser: UpdateUser = {};
    if (values.dw_playlist_id !== '') {
      updateUser.dw_playlist_id = values.dw_playlist_id;
    }
    if (values.send_mail && values.save_weekday) {
      updateUser.send_mail = values.send_mail;
      updateUser.tg_chat_id = values.tg_chat_id;
      updateUser.send_time = parseFormTime(
        values.save_hour_minute,
        values.save_weekday
      );
    }
    if (values.send_mail === false) {
      updateUser.send_mail = false;
    }
    if (updateUser && userId) {
      const res = await updateUserDataV2(userId, updateUser);
      if (!res) {
        throw new Error(`Error while updating user: ${res}`);
      }
      setUserData(res);
    } else {
      console.error('No user id');
    }
  }
  useEffect(() => {
    if (userData.user_id && userData.dw_playlist_id) {
      form.setValue('dw_playlist_id', userData.dw_playlist_id);
    }
    if (userData.send_mail) {
      form.setValue('send_mail', userData.send_mail);
    }
    if (userData.send_time) {
      form.setValue(
        'save_weekday',
        parseUserWeekDay(userData.send_time) || undefined
      );
      form.setValue('save_hour_minute', parseUserSaveTime(userData.send_time));
    }
    if (userData.email) {
      form.setValue('email', userData.email);
    }
    if (userData.tg_chat_id) {
      form.setValue('tg_chat_id', userData.tg_chat_id);
    }
  }, [form, userData]);
  return (
    <div className="rounded-md bg-secondary bg-opacity-30 p-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, (errors) =>
            console.error('Validation errors:', errors)
          )}
          className="space-y-4"
        >
          <div className="flex justify-between">
            <FormField
              control={form.control}
              name="send_mail"
              render={({ field }) => (
                <FormItem className="flex items-center gap-x-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="m-0">Send notification</FormLabel>
                </FormItem>
              )}
            />
            <Button
              onClick={async (e) => {
                e.preventDefault();
                if (!userData.tg_chat_id) {
                  console.warn('No tg_chat_id');
                  return;
                }
                setCredentials(userData.user_id);
                const res =
                  await UserService.testNotificationApiTestNotificationPost({
                    tg_chat_id: userData.tg_chat_id,
                    subject: 'test',
                    text: 'test',
                  });
                console.info(res);
              }}
            >
              Test Notification
            </Button>
          </div>
          {(sendMailValue || userData.send_mail) && (
            <>
              <FormField
                control={form.control}
                name="tg_chat_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telegram chat id</FormLabel>
                    <FormControl className="mt-1">
                      <Input placeholder="123456789" {...field} />
                    </FormControl>
                    <FormMessage className="pt-1" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="save_weekday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="m-0">Notification day</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(value: singleWeekDay) => {
                          if (value) {
                            form.setValue('save_weekday', value);
                          }
                        }}
                      >
                        {weekDays.map((dw) => (
                          <ToggleGroupItem key={dw} value={dw}>
                            <p className="p-1">{dw}</p>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="save_hour_minute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="m-0">Notification time</FormLabel>
                    <Input type="time" {...field} />
                  </FormItem>
                )}
              />
            </>
          )}
          <FormField
            control={form.control}
            name="dw_playlist_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discover Weekly playlist id</FormLabel>
                <FormControl className="mt-1">
                  <Input placeholder="37i9..." {...field} />
                </FormControl>
                <FormMessage className="pt-1" />
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
      </Form>
    </div>
  );
};
