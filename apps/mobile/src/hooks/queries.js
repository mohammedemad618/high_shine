import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';

export const queryKeys = {
  courses: (q) => ['courses', q || ''],
  course: (id) => ['course', id],
  myCourses: ['me', 'courses'],
  me: ['me'],
};

export function useCourses(q) {
  return useQuery({
    queryKey: queryKeys.courses(q),
    queryFn: () => endpoints.listCourses({ q }),
    placeholderData: keepPreviousData,
  });
}

export function useCourse(id) {
  return useQuery({ queryKey: queryKeys.course(id), queryFn: () => endpoints.getCourse(id), enabled: !!id });
}

export function useMyCourses() {
  return useQuery({ queryKey: queryKeys.myCourses, queryFn: endpoints.getMyCourses });
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: endpoints.getMe });
}
