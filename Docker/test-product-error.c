#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "spproduct.h"

static uint64_t random_state = UINT64_C(0x918d27832187a1f5);

static double
random_double(void)
{
    double number;
    random_state ^= random_state << 13;
    random_state ^= random_state >> 7;
    random_state ^= random_state << 17;
    memcpy(&number, &random_state, sizeof(number));
    return number;
}

static void
check_product_error(double x, double y)
{
    double expected = fma(x, y, -(x * y));
    double actual = spProductError(x, y);
    if (isnan(expected)) {
        assert(isnan(actual));
    } else if (expected == 0.0) {
        /* Residual accumulation adds exact zero to +0, so its sign is immaterial. */
        assert(actual == 0.0);
    } else if (memcmp(&expected, &actual, sizeof(actual))) {
        fprintf(stderr, "Product error differs: x=%a y=%a expected=%a actual=%a\n",
                x, y, expected, actual);
        assert(0);
    }
}

int
main(void)
{
    const double minimum = scalbn(1.0, DBL_MIN_EXP / 2 + DBL_MANT_DIG);
    const double maximum = scalbn(1.0, DBL_MAX_EXP / 2 - DBL_MANT_DIG);
    const double boundaries[] = {
        0.0, -0.0, DBL_TRUE_MIN, -DBL_TRUE_MIN, DBL_MIN, -DBL_MIN,
        nextafter(minimum, 0.0), minimum, nextafter(minimum, INFINITY),
        nextafter(maximum, 0.0), maximum, nextafter(maximum, INFINITY),
        -minimum, -maximum, 1.0, -1.0, nextafter(1.0, 0.0),
        nextafter(1.0, INFINITY), DBL_MAX, -DBL_MAX, INFINITY, -INFINITY, NAN
    };
    const size_t count = sizeof(boundaries) / sizeof(boundaries[0]);
    size_t i, j;
    int exponent;
    for (i = 0; i < count; i++)
        for (j = 0; j < count; j++)
            check_product_error(boundaries[i], boundaries[j]);
    for (exponent = -1074; exponent < DBL_MAX_EXP; exponent++) {
        double power = scalbn(1.0, exponent);
        check_product_error(nextafter(power, INFINITY), nextafter(1.0, INFINITY));
        check_product_error(nextafter(power, 0.0), nextafter(1.0, 0.0));
    }
    for (i = 0; i < 5000000; i++) {
        double x = random_double();
        double y = random_double();
        check_product_error(x, y);
    }
    puts("Product residual matches FMA: boundary cases, all binary64 exponents, 5000000 random pairs");
    return 0;
}
