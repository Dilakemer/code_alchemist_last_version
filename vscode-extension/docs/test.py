# broken_app.py

import math


class Stats:

    @staticmethod
    def mean(nums):
        if not nums:
            return 0
        total = 0
        for n in nums:
            total += n
        return total / len(nums)


    @staticmethod
    def median(nums):
        if not nums:
            return 0
        
        sorted_nums = sorted(nums)
        n = len(sorted_nums)
        mid = n // 2

        if n % 2 == 0:
            return (sorted_nums[mid - 1] + sorted_nums[mid]) / 2
        else:
            return sorted_nums[mid]


def divide_numbers(a, b):
    if b == 0:
        return "Hata: Sıfıra bölme yapılamaz"
    return a / b


def read_file(path):
    try:
        with open(path, "r") as f:
            return f.read()
    except FileNotFoundError:
        return "Hata: Dosya bulunamadı"


def calculate_circle(r):
    return math.pi * r ** 2


if __name__ == "__main__":
    data = [1, 2, 3, 4, 5]
    print("Mean:", Stats.mean(data))
    print("Median:", Stats.median(data))
    print("Division (10/0):", divide_numbers(10, 0))
    print("Circle Area (r=5):", calculate_circle(5))
